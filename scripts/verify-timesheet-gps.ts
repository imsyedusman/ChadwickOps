/**
 * WorkGuru Timesheet GPS Diagnostic (Phase 2A)
 *
 * Local-only, read-only. Fetches ONE timesheet by id from the WorkGuru V1
 * `TimeSheet/GetTimeSheetById` endpoint and prints:
 *   - staff, project, task
 *   - start/finish and creation/modification timestamps, verbatim and interpreted
 *     (start/finish are WorkGuru local time; creation/modification are UTC)
 *   - latitude/longitude, plus a map link for comparison with the Geolocation dashboard
 *
 * Deliberate constraints:
 *   - No database access, no `.env` loading, no writes, no other endpoints.
 *   - Credentials come from the process environment only, for this run, and are
 *     never printed. Nothing is persisted.
 *   - Location precision is reduced unless `--precise` is passed, and the map link
 *     can be suppressed with `--no-map`.
 *
 * Usage:
 *   export WORKGURU_API_KEY='...'
 *   export WORKGURU_API_SECRET='...'
 *   npx tsx scripts/verify-timesheet-gps.ts 123456
 *
 * Options:
 *   --base <url>     API base (default https://api.workguru.io)
 *                    UK tenants: https://ukapi.workguru.io
 *   --tz <iana>      Tenant timezone (default Australia/Sydney)
 *   --json           Machine-readable output
 *   --precise        Print coordinates at full precision
 *   --no-map         Omit the Google Maps link
 *   --probe          Query documented read endpoints that may expose GPS
 *   --self-test      Run offline timestamp checks and exit
 *   --help           Show usage
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DEFAULT_BASE = 'https://api.workguru.io';
const DEFAULT_TZ = 'Australia/Sydney';
const AUTH_PATH = '/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth';
const TIMESHEET_PATH = '/api/services/app/TimeSheet/GetTimeSheetById';

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EXCESS_FRACTION = /(\.\d{3})\d+/;

interface Options {
  id: string | null;
  base: string;
  tz: string;
  json: boolean;
  precise: boolean;
  map: boolean;
  probe: boolean;
  selfTest: boolean;
  help: boolean;
}

type TimeBasis = 'tenant-local' | 'utc';

interface ProbeEndpointResult {
  name: string;
  status: number | null;
  itemCount: number | null;
  found: boolean;
  latitude: number | null;
  longitude: number | null;
  leftSiteDuringShift: boolean | null;
  offSiteMinutes: number | null;
  startTime: string | null;
  finishTime: string | null;
  creationTime: string | null;
  error: string | null;
}

interface TimestampReading {
  raw: string | null;
  presence: 'value' | 'null' | 'missing';
  basis: TimeBasis;
  source:
    | 'tenant local (serialized offset ignored)'
    | 'tenant local (no offset)'
    | 'UTC (no offset)'
    | 'explicit offset'
    | 'date only'
    | 'empty'
    | 'unparsable';
  utcIso: string | null;
  sydney: string | null;
  truncatedFraction: boolean;
}

interface DiagnosticResult {
  diagnostic: 'workguru-timesheet-gps';
  readOnly: true;
  fetchedAtUtc: string;
  apiBase: string;
  timezone: string;
  timesheet: {
    id: string | null;
    status: string | null;
    weeklyEntry: boolean | null;
    staff: { userId: string | null; name: string | null };
    project: { projectId: string | null; number: string | null; name: string | null };
    task: { taskId: string | null; name: string | null };
    lengthHours: number | null;
  };
  timestamps: {
    startTime: TimestampReading;
    finishTime: TimestampReading;
    creationTime: TimestampReading;
    lastModificationTime: TimestampReading;
  };
  gps: {
    latitude: number | null;
    longitude: number | null;
    hasCoordinates: boolean;
    accuracyMetres: null;
    capturedAtUtc: null;
    mapUrl: string | null;
    precision: 'rounded-5dp' | 'full';
  };
  derived: {
    startToFinishHours: number | null;
    submissionAfterStartMinutes: number | null;
    amendedAfterCreationMinutes: number | null;
  };
  timeBasis: {
    startFinish: 'tenant-local';
    audit: 'utc';
  };
  probe: ProbeEndpointResult[] | null;
  warnings: string[];
  note: string;
}

function usage(): string {
  return [
    'WorkGuru Timesheet GPS Diagnostic (read-only, local)',
    '',
    'Usage:',
    '  npx tsx scripts/verify-timesheet-gps.ts <timesheetId> [options]',
    '',
    'Credentials (environment only, never printed or persisted):',
    "  export WORKGURU_API_KEY='...'",
    "  export WORKGURU_API_SECRET='...'",
    '',
    'Options:',
    '  --id <n>       Timesheet id (alternative to the positional argument)',
    `  --base <url>   API base (default ${DEFAULT_BASE}; UK: https://ukapi.workguru.io)`,
    `  --tz <iana>    Tenant timezone (default ${DEFAULT_TZ})`,
    '  --json         Machine-readable output (no credentials, no token)',
    '  --precise      Print coordinates at full precision',
    '  --no-map       Do not print a Google Maps link',
    '  --probe        Query documented read endpoints that may expose GPS',
    '  --self-test    Run offline timestamp checks and exit',
    '  --help         Show this message',
    '',
    'This script never reads the database or .env files. It makes two requests by',
    'default; --probe adds five documented read-only timesheet/project queries.',
  ].join('\n');
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    id: null,
    base: process.env.WORKGURU_API_BASE?.trim() || DEFAULT_BASE,
    tz: process.env.WORKGURU_TENANT_TZ?.trim() || DEFAULT_TZ,
    json: false,
    precise: false,
    map: true,
    probe: false,
    selfTest: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--id':
        options.id = argv[++i] ?? null;
        break;
      case '--base':
        options.base = argv[++i] ?? options.base;
        break;
      case '--tz':
        options.tz = argv[++i] ?? options.tz;
        break;
      case '--json':
        options.json = true;
        break;
      case '--precise':
        options.precise = true;
        break;
      case '--no-map':
        options.map = false;
        break;
      case '--probe':
        options.probe = true;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          fail(`Unknown option: ${arg}\n\n${usage()}`, 2);
        }
        if (options.id === null) {
          options.id = arg;
        } else {
          fail(`Unexpected extra argument: ${arg}`, 2);
        }
    }
  }

  return options;
}

class DiagnosticExit extends Error {
  constructor(readonly code: number) {
    super(`Diagnostic exit ${code}`);
    this.name = 'DiagnosticExit';
  }
}

/**
 * Ends the diagnostic without calling `process.exit()`. On Windows, exiting
 * abruptly while fetch keep-alive sockets are closing trips a libuv assertion
 * that corrupts the exit code, so the code is set and the error is unwound.
 */
function fail(message: string, code: number): never {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
  throw new DiagnosticExit(code);
}

function assertBaseUrl(base: string): string {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    fail(`Invalid --base URL: ${base}`, 2);
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    fail('Refusing to send credentials over a non-HTTPS base URL (localhost excepted).', 2);
  }
  return base.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * WorkGuru (ABP) emits timestamps with up to 7 fractional digits, which
 * `Date` cannot parse. Only the parsed copy is normalised; the raw string is
 * always reported unchanged.
 */
function normalizeForParse(raw: string): string {
  return raw.trim().replace(' ', 'T').replace(EXCESS_FRACTION, '$1');
}

function interpretTimestamp(raw: string | null, tz: string, basis: TimeBasis): TimestampReading {
  if (raw === null) {
    return {
      raw: null,
      presence: 'null',
      basis,
      source: 'empty',
      utcIso: null,
      sydney: null,
      truncatedFraction: false,
    };
  }
  if (raw.trim() === '') {
    return {
      raw,
      presence: 'value',
      basis,
      source: 'empty',
      utcIso: null,
      sydney: null,
      truncatedFraction: false,
    };
  }

  const normalized = normalizeForParse(raw);
  const truncatedFraction = EXCESS_FRACTION.test(raw);
  const hasOffset = OFFSET_SUFFIX.test(normalized);
  const dateOnly = DATE_ONLY.test(raw.trim());
  const bare = normalized.replace(OFFSET_SUFFIX, '');

  let instant: Date;
  let source: TimestampReading['source'];

  if (basis === 'tenant-local') {
    // WorkGuru documents startTime/finishTime as local time. It serialises them
    // with a +00:00 suffix even for non-UTC tenants, so the suffix is not used.
    instant = fromZonedTime(dateOnly ? `${raw.trim()}T00:00:00` : bare, tz);
    source = hasOffset ? 'tenant local (serialized offset ignored)' : 'tenant local (no offset)';
  } else if (dateOnly) {
    instant = new Date(`${raw.trim()}T00:00:00Z`);
    source = 'date only';
  } else if (hasOffset) {
    instant = new Date(normalized);
    source = 'explicit offset';
  } else {
    // ABP audit fields are UTC but are serialised without a Z suffix.
    instant = new Date(`${normalized}Z`);
    source = 'UTC (no offset)';
  }

  if (Number.isNaN(instant.getTime())) {
    return { raw, presence: 'value', basis, source: 'unparsable', utcIso: null, sydney: null, truncatedFraction };
  }

  return {
    raw,
    presence: 'value',
    basis,
    source,
    utcIso: instant.toISOString(),
    sydney: formatInTimeZone(instant, tz, 'yyyy-MM-dd HH:mm:ss zzz (XXX)'),
    truncatedFraction,
  };
}

function readField(
  record: Record<string, unknown>,
  key: string,
  tz: string,
  basis: TimeBasis
): TimestampReading {
  if (!(key in record)) {
    return {
      raw: null,
      presence: 'missing',
      basis,
      source: 'empty',
      utcIso: null,
      sydney: null,
      truncatedFraction: false,
    };
  }
  const value = record[key];
  if (value === null || value === undefined) return interpretTimestamp(null, tz, basis);
  if (typeof value !== 'string') return interpretTimestamp(String(value), tz, basis);
  return interpretTimestamp(value, tz, basis);
}

function datePart(reading: TimestampReading, tz: string): string | null {
  if (reading.raw) {
    const match = reading.raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (reading.utcIso) return formatInTimeZone(new Date(reading.utcIso), tz, 'yyyy-MM-dd');
  return null;
}

function extractItems(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter(isRecord);
  if (!isRecord(json)) return [];
  const result = json.result;
  if (Array.isArray(result)) return result.filter(isRecord);
  if (isRecord(result) && Array.isArray(result.items)) return result.items.filter(isRecord);
  if (Array.isArray(json.items)) return json.items.filter(isRecord);
  return [];
}

interface ProbeContext {
  base: string;
  token: string;
  id: string;
  userId: string | null;
  projectId: string | null;
  targetDate: string;
  startDate: string;
  endDate: string;
  precise: boolean;
  sanitize: (text: string) => string;
}

/**
 * Queries the documented read endpoints that return TimeSheetDto/TimeSheetSummary.
 * Every one of them reads the same timesheet row, so this distinguishes "the GPS
 * is stored but GetTimeSheetById hides it" from "the row has no GPS at all".
 */
async function probeGpsSources(ctx: ProbeContext): Promise<ProbeEndpointResult[]> {
  const endpoints: Array<{
    name: string;
    path: string;
    params: Record<string, string | number | boolean>;
    extract?: (json: unknown) => Record<string, unknown>[];
  }> = [];

  if (ctx.userId) {
    endpoints.push(
      {
        name: 'GetTimeSheetsByUserIdAndDate',
        path: '/api/services/app/TimeSheet/GetTimeSheetsByUserIdAndDate',
        params: { userId: ctx.userId, startDate: ctx.targetDate, includeZeros: false },
      },
      {
        name: 'GetTimeSheetsByUserIdAndDateRange',
        path: '/api/services/app/TimeSheet/GetTimeSheetsByUserIdAndDateRange',
        params: {
          userId: ctx.userId,
          startDate: ctx.startDate,
          endDate: ctx.endDate,
          includeZeros: false,
        },
      },
      {
        name: 'GetAllTimeSheetsInDateRange',
        path: '/api/services/app/TimeSheet/GetAllTimeSheetsInDateRange',
        params: { startDate: ctx.startDate, endDate: ctx.endDate, staffId: ctx.userId },
      },
      {
        name: 'GetTimeSheetsForMob2',
        path: '/api/services/app/TimeSheet/GetTimeSheetsForMob2',
        params: {
          UserId: ctx.userId,
          StartDate: ctx.startDate,
          EndDate: ctx.endDate,
          MaxResultCount: 100,
        },
      }
    );
  }

  if (ctx.projectId) {
    endpoints.push({
      name: 'GetProjectById.timeSheets',
      path: '/api/services/app/Project/GetProjectById',
      params: { id: ctx.projectId },
      extract: (json) => {
        const result = isRecord(json) && isRecord(json.result) ? json.result : null;
        const sheets = result?.timeSheets ?? result?.TimeSheets;
        return Array.isArray(sheets) ? sheets.filter(isRecord) : [];
      },
    });
  }

  const results: ProbeEndpointResult[] = [];
  for (const endpoint of endpoints) {
    const query = new URLSearchParams(
      Object.entries(endpoint.params).map(([key, value]) => [key, String(value)])
    );
    const url = `${ctx.base}${endpoint.path}?${query.toString()}`;
    const entry: ProbeEndpointResult = {
      name: endpoint.name,
      status: null,
      itemCount: null,
      found: false,
      latitude: null,
      longitude: null,
      leftSiteDuringShift: null,
      offSiteMinutes: null,
      startTime: null,
      finishTime: null,
      creationTime: null,
      error: null,
    };

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${ctx.token}` },
        signal: AbortSignal.timeout(20000),
      });
      entry.status = response.status;
      const text = await response.text();
      if (!response.ok) {
        entry.error = `HTTP ${response.status}: ${ctx.sanitize(text)}`;
        results.push(entry);
        continue;
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        entry.error = 'response was not valid JSON';
        results.push(entry);
        continue;
      }

      const items = endpoint.extract ? endpoint.extract(json) : extractItems(json);
      entry.itemCount = items.length;
      const match = items.find((item) => String(item.id ?? item.Id ?? '') === ctx.id);
      if (match) {
        entry.found = true;
        entry.latitude = roundCoordinate(pickNumber(match.latitude, match.Latitude), ctx.precise);
        entry.longitude = roundCoordinate(pickNumber(match.longitude, match.Longitude), ctx.precise);
        const leftSite = match.leftSiteDuringShift ?? match.LeftSiteDuringShift;
        entry.leftSiteDuringShift = typeof leftSite === 'boolean' ? leftSite : null;
        entry.offSiteMinutes = pickNumber(match.offSiteMinutes, match.OffSiteMinutes);
        entry.startTime = pickString(match.startTime, match.StartTime);
        entry.finishTime = pickString(match.finishTime, match.FinishTime);
        entry.creationTime = pickString(match.creationTime, match.CreationTime);
      }
    } catch (error) {
      entry.error = ctx.sanitize(error instanceof Error ? error.message : String(error));
    }
    results.push(entry);
  }

  return results;
}

function roundCoordinate(value: number | null, precise: boolean): number | null {
  if (value === null) return null;
  return precise ? value : Number(value.toFixed(5));
}

function minutesBetween(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso || !toIso) return null;
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
}

function hoursBetween(fromIso: string | null, toIso: string | null): number | null {
  const minutes = minutesBetween(fromIso, toIso);
  return minutes === null ? null : Number((minutes / 60).toFixed(2));
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'n/a';
  if (minutes === 0) return '0 min';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  if (abs < 60) return `${sign}${abs} min`;
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `${sign}${hours} h ${rest} min`;
}

function formatHours(hours: number | null): string {
  return hours === null ? 'n/a' : `${hours.toFixed(2)} h`;
}

function pad(label: string, width = 22): string {
  return label.padEnd(width);
}

function presenceLabel(reading: TimestampReading): string {
  if (reading.presence === 'missing') return '(field not returned)';
  if (reading.presence === 'null') return '(null)';
  return reading.raw ?? '(empty)';
}

function buildWarnings(result: Omit<DiagnosticResult, 'warnings' | 'note'>): string[] {
  const warnings: string[] = [];
  const timesheet = result.timesheet;
  const timestamps = result.timestamps;

  if (timesheet.weeklyEntry === true) {
    warnings.push('Weekly/day-level entry: startTime and finishTime are normally null by design.');
  }
  if (
    timesheet.weeklyEntry !== true &&
    (timestamps.startTime.utcIso === null || timestamps.finishTime.utcIso === null)
  ) {
    warnings.push('Missing or unparsable start/finish time: duration cannot be verified.');
  }
  if (!result.gps.hasCoordinates) {
    warnings.push(
      'No GPS coordinates on this record. Expected for web, kiosk, import or permission-denied entries; the API does not say which.'
    );
  }
  if (
    timestamps.startTime.utcIso &&
    timestamps.finishTime.utcIso &&
    new Date(timestamps.finishTime.utcIso).getTime() <= new Date(timestamps.startTime.utcIso).getTime()
  ) {
    warnings.push('finishTime is not after startTime. Check overnight handling or the source record.');
  }
  if (
    timesheet.lengthHours !== null &&
    result.derived.startToFinishHours !== null &&
    Math.abs(timesheet.lengthHours - result.derived.startToFinishHours) > 0.05
  ) {
    warnings.push(
      `length (${formatHours(timesheet.lengthHours)}) differs from start->finish (${formatHours(
        result.derived.startToFinishHours
      )}).`
    );
  }
  if (result.derived.submissionAfterStartMinutes !== null) {
    if (result.derived.submissionAfterStartMinutes > 12 * 60) {
      warnings.push('Created more than 12 h after the entered start time: strongly backdated entry.');
    } else if (result.derived.submissionAfterStartMinutes < -1) {
      warnings.push('Created before the entered start time (pre-entered).');
    }
  }
  if (timestamps.lastModificationTime.utcIso) {
    warnings.push(
      'Record was amended after creation. The API exposes no edit history, so any GPS must be treated as the mobile submission location, not the edited times.'
    );
  }
  warnings.push(
    `Time basis: start/finish = ${result.timezone} local time (a serialized +00:00 suffix is ignored); creation/modification = UTC. WorkGuru does not return the user's own timezone.`
  );
  if (
    [timestamps.startTime, timestamps.finishTime, timestamps.creationTime, timestamps.lastModificationTime].some(
      (reading) => reading.truncatedFraction
    )
  ) {
    warnings.push('Fractional seconds beyond milliseconds were truncated for parsing only; raw values are unchanged above.');
  }

  return warnings;
}

function renderHuman(result: DiagnosticResult, options: Options): string {
  const lines: string[] = [];
  const t = result.timesheet;
  const stamps = result.timestamps;

  lines.push('WorkGuru Timesheet GPS Diagnostic (read-only)');
  lines.push(`Fetched:  ${result.fetchedAtUtc}`);
  lines.push(`API base: ${result.apiBase}`);
  lines.push(`Timezone: ${result.timezone}`);
  lines.push('');

  lines.push('Timesheet');
  lines.push(`  ${pad('id')}${t.id ?? '(not returned)'}`);
  lines.push(`  ${pad('status')}${t.status ?? '(not returned)'}`);
  lines.push(`  ${pad('entry type')}${t.weeklyEntry === true ? 'weekly / day-level' : 'daily (start/finish)'}`);
  lines.push(`  ${pad('staff')}${t.staff.name ?? '(not returned)'}${t.staff.userId ? `  (userId ${t.staff.userId})` : ''}`);
  lines.push(
    `  ${pad('project')}${t.project.number ?? '(no number)'}  ${t.project.name ?? ''}${
      t.project.projectId ? `  (projectId ${t.project.projectId})` : ''
    }`
  );
  lines.push(`  ${pad('task')}${t.task.name ?? '(not returned)'}${t.task.taskId ? `  (taskId ${t.task.taskId})` : ''}`);
  lines.push(`  ${pad('length')}${formatHours(t.lengthHours)}`);
  lines.push('');

  lines.push('Raw timestamps (verbatim from the API)');
  lines.push(`  ${pad('startTime')}${presenceLabel(stamps.startTime)}`);
  lines.push(`  ${pad('finishTime')}${presenceLabel(stamps.finishTime)}`);
  lines.push(`  ${pad('creationTime')}${presenceLabel(stamps.creationTime)}`);
  lines.push(`  ${pad('lastModificationTime')}${presenceLabel(stamps.lastModificationTime)}`);
  lines.push('');

  lines.push(`Interpreted (start/finish: ${result.timezone} local; creation/modification: UTC)`);
  for (const [label, reading] of [
    ['startTime', stamps.startTime],
    ['finishTime', stamps.finishTime],
    ['creationTime', stamps.creationTime],
    ['lastModificationTime', stamps.lastModificationTime],
  ] as const) {
    lines.push(`  ${label}`);
    if (reading.utcIso === null) {
      lines.push(`    ${pad('source', 14)}${reading.source}`);
      lines.push(`    ${pad('Sydney', 14)}n/a`);
      lines.push(`    ${pad('UTC', 14)}n/a`);
      continue;
    }
    lines.push(`    ${pad('source', 14)}${reading.source}`);
    lines.push(`    ${pad('Sydney', 14)}${reading.sydney}`);
    lines.push(`    ${pad('UTC', 14)}${reading.utcIso}`);
  }
  lines.push('');

  lines.push('GPS');
  if (result.gps.hasCoordinates) {
    lines.push(`  ${pad('latitude')}${result.gps.latitude}`);
    lines.push(`  ${pad('longitude')}${result.gps.longitude}`);
    lines.push(`  ${pad('accuracy')}not exposed by the V1 API`);
    lines.push(`  ${pad('captured at')}not exposed by the V1 API`);
    if (result.gps.mapUrl) lines.push(`  ${pad('map')}${result.gps.mapUrl}`);
    if (!options.precise) lines.push('  (coordinates rounded to 5 decimal places; use --precise for full values)');
  } else {
    lines.push('  No coordinates on this timesheet.');
    lines.push('  Expected for web/kiosk/import/weekly entries or denied device permission.');
  }
  lines.push('');

  if (result.probe) {
    lines.push('GPS probes (documented V1 read endpoints)');
    if (result.probe.length === 0) {
      lines.push('  No userId/projectId was returned, so no probes could be built.');
    }
    for (const p of result.probe) {
      const state = p.error
        ? `error: ${p.error}`
        : p.found
          ? `found id ${result.timesheet.id ?? ''}`
          : `id not found in ${p.itemCount ?? '?'} row(s)`;
      lines.push(`  ${p.name}`);
      lines.push(`    HTTP ${p.status ?? 'n/a'}  ${state}`);
      if (p.found) {
        lines.push(
          `    lat/long ${p.latitude ?? 'null'}, ${p.longitude ?? 'null'}  leftSite ${p.leftSiteDuringShift ?? 'n/a'}  offSiteMinutes ${p.offSiteMinutes ?? 'n/a'}`
        );
        lines.push(
          `    times start=${p.startTime ?? 'null'} finish=${p.finishTime ?? 'null'} created=${p.creationTime ?? 'null'}`
        );
      }
    }
    lines.push('');
  }

  lines.push('Checks');
  lines.push(`  ${pad('start -> finish')}${formatHours(result.derived.startToFinishHours)}${t.lengthHours !== null ? `  (length ${formatHours(t.lengthHours)})` : ''}`);
  lines.push(`  ${pad('created after start')}${formatMinutes(result.derived.submissionAfterStartMinutes)}`);
  lines.push(`  ${pad('amended after created')}${formatMinutes(result.derived.amendedAfterCreationMinutes)}`);
  lines.push('');

  lines.push('Compare with WorkGuru');
  const startDate = stamps.startTime.utcIso
    ? formatInTimeZone(new Date(stamps.startTime.utcIso), result.timezone, 'yyyy-MM-dd')
    : '(unknown)';
  const finishDate = stamps.finishTime.utcIso
    ? formatInTimeZone(new Date(stamps.finishTime.utcIso), result.timezone, 'yyyy-MM-dd')
    : startDate;
  lines.push(`  1. Timesheets -> Geolocation, Start ${startDate}, End ${finishDate}.`);
  lines.push(`  2. Filter to staff: ${t.staff.name ?? '(unknown)'}.`);
  lines.push(`  3. Open the pin for timesheet ${t.id ?? '(unknown)'} on ${t.project.number ?? '(unknown project)'}.`);
  lines.push('  4. Compare the pin start/finish with the raw timestamps above.');
  lines.push('  Note: the dashboard shows start and finish locations; this API returns one coordinate pair per entry.');
  lines.push('');

  if (result.warnings.length > 0) {
    lines.push('Warnings');
    for (const warning of result.warnings) lines.push(`  - ${warning}`);
    lines.push('');
  }

  lines.push('No data was written. No credentials or tokens are included in this output.');
  return lines.join('\n');
}

function selfTest(): void {
  const tz = DEFAULT_TZ;
  const cases: Array<{
    name: string;
    raw: string;
    basis: TimeBasis;
    expected: string | null;
    expectedSydney?: string;
  }> = [
    {
      name: 'start local +00:00 ignored (Sydney AEDT)',
      raw: '2026-11-06T06:00:00+00:00',
      basis: 'tenant-local',
      expected: '2026-11-05T19:00:00.000Z',
    },
    {
      name: 'finish local +00:00 ignored (Sydney AEDT)',
      raw: '2026-11-06T07:30:00+00:00',
      basis: 'tenant-local',
      expected: '2026-11-05T20:30:00.000Z',
    },
    {
      name: 'creation UTC no offset -> GPS event',
      raw: '2026-11-05T20:21:05.508798',
      basis: 'utc',
      expected: '2026-11-05T20:21:05.508Z',
      expectedSydney: '2026-11-06 07:21:05 AEDT (+11:00)',
    },
    {
      name: 'creation explicit UTC',
      raw: '2026-11-05T20:21:05Z',
      basis: 'utc',
      expected: '2026-11-05T20:21:05.000Z',
    },
    {
      name: 'creation explicit +11:00',
      raw: '2026-11-06T07:21:05+11:00',
      basis: 'utc',
      expected: '2026-11-05T20:21:05.000Z',
    },
    {
      name: 'Sydney summer local',
      raw: '2026-01-15T08:00:00',
      basis: 'tenant-local',
      expected: '2026-01-14T21:00:00.000Z',
    },
    {
      name: 'Sydney winter local',
      raw: '2026-07-15T08:00:00',
      basis: 'tenant-local',
      expected: '2026-07-14T22:00:00.000Z',
    },
    {
      name: 'seven fractional digits (UTC)',
      raw: '2026-07-15T08:00:00.1234567',
      basis: 'utc',
      expected: '2026-07-15T08:00:00.123Z',
    },
    {
      name: 'space separator (local)',
      raw: '2026-07-15 08:00:00',
      basis: 'tenant-local',
      expected: '2026-07-14T22:00:00.000Z',
    },
    {
      name: 'date only (Sydney midnight)',
      raw: '2026-07-15',
      basis: 'tenant-local',
      expected: '2026-07-14T14:00:00.000Z',
    },
    { name: 'null', raw: '', basis: 'tenant-local', expected: null },
  ];

  let failures = 0;
  for (const testCase of cases) {
    const reading =
      testCase.raw === ''
        ? interpretTimestamp(null, tz, testCase.basis)
        : interpretTimestamp(testCase.raw, tz, testCase.basis);
    const utcOk = reading.utcIso === testCase.expected;
    const sydneyOk =
      testCase.expectedSydney === undefined || reading.sydney === testCase.expectedSydney;
    const ok = utcOk && sydneyOk;
    process.stdout.write(
      `${ok ? 'PASS' : 'FAIL'}  ${testCase.name}${
        ok ? '' : ` (got utc ${reading.utcIso}, sydney ${reading.sydney})`
      }\n`
    );
    if (!ok) failures += 1;
  }

  if (failures > 0) fail(`\n${failures} self-test(s) failed.`, 1);
  process.stdout.write(`\nSelf-test passed (${cases.length} checks). No network or credentials used.\n`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.selfTest) {
    selfTest();
    return;
  }
  if (!options.id) {
    fail(`Missing timesheet id.\n\n${usage()}`, 2);
  }
  if (!/^\d+$/.test(options.id)) {
    fail(
      `Timesheet id must be the numeric V1 id (for example 123456). V2 ids use a "ts_" prefix and are not accepted by GetTimeSheetById.`,
      2
    );
  }

  const base = assertBaseUrl(options.base);
  const apiKey = process.env.WORKGURU_API_KEY?.trim();
  const apiSecret = process.env.WORKGURU_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    fail(
      [
        'Missing credentials. This script reads the environment only, never the database or .env files.',
        '',
        "  export WORKGURU_API_KEY='...'",
        "  export WORKGURU_API_SECRET='...'",
        '',
        'Then re-run. Use a read-only API key for verification where possible.',
      ].join('\n'),
      2
    );
  }

  const redactions: string[] = [apiKey, apiSecret];
  const sanitize = (text: string): string => {
    let output = text;
    for (const secret of redactions) {
      if (secret) output = output.split(secret).join('[redacted]');
    }
    output = output.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted]');
    output = output.replace(/("?(?:apiKey|secret|accessToken|token|authorization)"?\s*[:=]\s*"?)[^",}\s]+/gi, '$1[redacted]');
    return output.slice(0, 400);
  };

  const authResponse = await fetch(`${base}${AUTH_PATH}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, secret: apiSecret }),
    signal: AbortSignal.timeout(20000),
  }).catch((error: unknown) => {
    fail(`Could not reach WorkGuru at ${base}: ${sanitize(error instanceof Error ? error.message : String(error))}`, 3);
  });

  const authText = await authResponse.text();
  if (!authResponse.ok) {
    fail(
      `Authentication failed (HTTP ${authResponse.status}). ${sanitize(authText) || 'No response body.'}\nCheck the key/secret and the --base region.`,
      3
    );
  }

  let accessToken: string | null = null;
  try {
    const authJson = JSON.parse(authText) as Record<string, unknown>;
    accessToken = typeof authJson.accessToken === 'string' ? authJson.accessToken : null;
  } catch {
    fail('Authentication response was not valid JSON.', 3);
  }
  if (!accessToken) {
    fail('Authentication response did not contain an accessToken.', 3);
  }
  redactions.push(accessToken);

  const timesheetUrl = `${base}${TIMESHEET_PATH}?id=${encodeURIComponent(options.id)}`;
  const response = await fetch(timesheetUrl, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20000),
  }).catch((error: unknown) => {
    fail(`Timesheet request failed: ${sanitize(error instanceof Error ? error.message : String(error))}`, 3);
  });

  const responseText = await response.text();
  if (!response.ok) {
    const hint =
      response.status === 401 || response.status === 403
        ? ' Check that the key can read timesheets in this tenant.'
        : response.status === 404
          ? ' No timesheet with that id was returned for this tenant.'
          : '';
    fail(`GetTimeSheetById failed (HTTP ${response.status}).${hint} ${sanitize(responseText)}`.trim(), 3);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    fail('Timesheet response was not valid JSON.', 4);
  }

  if (!isRecord(parsed)) fail('Unexpected timesheet response shape.', 4);
  const envelope = parsed as Record<string, unknown>;

  // ABP commonly answers 200 with `result: null` for an unknown id, so this must
  // be reported as "not found" rather than rendered as an empty timesheet.
  if (envelope.result === null) {
    fail(`No timesheet returned for id ${options.id}. The API may return a null result for an unknown id.`, 3);
  }
  if (envelope.result !== undefined && !isRecord(envelope.result)) {
    fail('Unexpected timesheet response shape (result is not an object).', 4);
  }

  const record = isRecord(envelope.result) ? envelope.result : envelope;
  if (!isRecord(record)) fail('Unexpected timesheet response shape (no result object).', 4);
  const r = record as Record<string, unknown>;

  const user = isRecord(r.user) ? r.user : null;
  const project = isRecord(r.project) ? r.project : null;
  const taskLineItem = isRecord(r.taskLineItem) ? r.taskLineItem : null;

  const staffName = pickString(
    user?.fullName,
    user?.name && user?.surname ? `${String(user.name)} ${String(user.surname)}`.trim() : null,
    typeof r.user === 'string' ? r.user : null,
    r.userName,
    r.staffName
  );

  const timestamps = {
    startTime: readField(r, 'startTime', options.tz, 'tenant-local'),
    finishTime: readField(r, 'finishTime', options.tz, 'tenant-local'),
    creationTime: readField(r, 'creationTime', options.tz, 'utc'),
    lastModificationTime: readField(r, 'lastModificationTime', options.tz, 'utc'),
  };

  const latitude = pickNumber(r.latitude, r.Latitude);
  const longitude = pickNumber(r.longitude, r.Longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  const displayLatitude = roundCoordinate(latitude, options.precise);
  const displayLongitude = roundCoordinate(longitude, options.precise);
  const mapUrl =
    displayLatitude !== null && displayLongitude !== null && options.map
      ? `https://www.google.com/maps/search/?api=1&query=${displayLatitude},${displayLongitude}`
      : null;

  const weeklyEntry =
    typeof r.isWeeklyTimesheetEntry === 'boolean'
      ? r.isWeeklyTimesheetEntry
      : typeof r.IsWeeklyTimesheetEntry === 'boolean'
        ? r.IsWeeklyTimesheetEntry
        : null;

  const startDate =
    datePart(timestamps.startTime, options.tz) ??
    formatInTimeZone(new Date(), options.tz, 'yyyy-MM-dd');
  const startDay = new Date(`${startDate}T00:00:00Z`);
  const rangeStart = new Date(startDay.getTime() - 86_400_000).toISOString().slice(0, 10);
  const rangeEnd = new Date(startDay.getTime() + 86_400_000).toISOString().slice(0, 10);

  const probe = options.probe
    ? await probeGpsSources({
        base,
        token: accessToken,
        id: options.id,
        userId: pickString(r.userId, r.UserId),
        projectId: pickString(r.projectId, r.ProjectID),
        targetDate: startDate,
        startDate: rangeStart,
        endDate: rangeEnd,
        precise: options.precise,
        sanitize,
      })
    : null;

  const partial: Omit<DiagnosticResult, 'warnings' | 'note'> = {
    diagnostic: 'workguru-timesheet-gps',
    readOnly: true,
    fetchedAtUtc: new Date().toISOString(),
    apiBase: base,
    timezone: options.tz,
    timesheet: {
      id: pickString(r.id, r.Id, r.TimeSheetID),
      status: pickString(r.status, r.Status),
      weeklyEntry,
      staff: { userId: pickString(r.userId, r.UserId), name: staffName },
      project: {
        projectId: pickString(r.projectId, r.ProjectID),
        number: pickString(project?.projectNo, project?.projectNumber, r.projectNo, r.ProjectNumber),
        name: pickString(project?.name, project?.projectName, typeof r.project === 'string' ? r.project : null),
      },
      task: {
        taskId: pickString(r.taskLineItemId, r.taskId, r.TaskID),
        name: pickString(taskLineItem?.name, taskLineItem?.taskName, typeof r.task === 'string' ? r.task : null, r.taskName),
      },
      lengthHours: pickNumber(r.length, r.Length),
    },
    timestamps,
    gps: {
      latitude: displayLatitude,
      longitude: displayLongitude,
      hasCoordinates,
      accuracyMetres: null,
      capturedAtUtc: null,
      mapUrl,
      precision: options.precise ? 'full' : 'rounded-5dp',
    },
    derived: {
      startToFinishHours: hoursBetween(timestamps.startTime.utcIso, timestamps.finishTime.utcIso),
      submissionAfterStartMinutes: minutesBetween(timestamps.startTime.utcIso, timestamps.creationTime.utcIso),
      amendedAfterCreationMinutes: minutesBetween(timestamps.creationTime.utcIso, timestamps.lastModificationTime.utcIso),
    },
    timeBasis: { startFinish: 'tenant-local', audit: 'utc' },
    probe,
  };

  const result: DiagnosticResult = {
    ...partial,
    warnings: buildWarnings(partial),
    note: 'Read-only diagnostic. Coordinates are the single pair stored on the timesheet; accuracy and capture time are not exposed by the V1 API.',
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderHuman(result, options)}\n`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof DiagnosticExit) return;
  if (!process.exitCode) process.exitCode = 1;
  process.stderr.write(`Diagnostic failed: ${error instanceof Error ? error.message : String(error)}\n`);
});
