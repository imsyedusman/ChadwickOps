import axios from 'axios';

const BASE_URL = 'https://api.workguru.io';

export interface WorkGuruProject {
  id?: number;
  ProjectID?: number;
  projectNo?: string;
  ProjectNumber?: string;
  projectName?: string;
  ProjectName?: string;
  name?: string;
  clientId?: number;
  ClientID?: number;
  status?: string;
  Status?: string;
  dueDate?: string;
  DueDate?: string;
  total?: number;
  Total?: number;
  description?: string;
  Description?: string;
  projectManager?: string | { name?: string; Name?: string };
  customFieldValues?: Array<{ customFieldId: number; value?: string; Value?: string }>;
  CustomFieldValues?: Array<{ CustomFieldID: number; Value?: string }>;
  customFields?: Array<{ key?: string; Key?: string; name?: string; Name?: string; value?: string; Value?: string; customField?: { name?: string; Name?: string } }>;
  lastModificationTime?: string;
  LastModificationTime?: string;
  lastModifierTime?: string;
  LastModifierTime?: string;
  creationTime?: string;
  CreationTime?: string;
  startDate?: string;
  StartDate?: string;
  productLineItems?: WorkGuruLineItem[];
  ProductLineItems?: WorkGuruLineItem[];
  timeSheets?: WorkGuruTimeSheet[];
  purchaseOrders?: WorkGuruPurchaseOrder[];
  invoices?: WorkGuruInvoice[];
}

export interface WorkGuruLineItem {
  id?: number;
  LineItemID?: number;
  productID?: number;
  ProductID?: number;
  name?: string;
  Name?: string;
  description?: string;
  Description?: string;
  quantity?: number;
  Quantity?: number;
  unitAmount?: number;
  unitPrice?: number;
  UnitPrice?: number;
  lineTotal?: number;
  total?: number;
  Total?: number;
}

export interface WorkGuruPurchaseOrder {
  id?: number;
  id_Internal?: number;
  number?: string;
  status?: string;
  issueDate?: string;
  total?: number;
  supplierName?: string;
  projectId?: number;
}

export interface WorkGuruInvoice {
  id?: number;
  invoiceID?: number;
  number?: string;
  status?: string;
  issueDate?: string;
  total?: number;
  totalNet?: number;
  projectId?: number;
}

export interface WorkGuruClient {
  id?: number;
  tenantId?: number;
  ClientID?: number;
  name?: string;
  ClientName?: string;
}

export interface WorkGuruTask {
  id?: number;
  TaskID?: number;
  name?: string;
  TaskName?: string;
  quantity?: number;
  Quantity?: number;
  actualHours?: number;
  ActualHours?: number;
}

export interface WorkGuruTimeSheet {
  id?: number;
  TimeSheetID?: number;
  projectId?: number;
  ProjectID?: number;
  taskId?: number;
  TaskID?: number;
  length?: number;
  Hours?: number;
  hours?: number;
  status?: string;
  Status?: string;
  date?: string;
  Date?: string;
  startTime?: string;
  user?: string;
  UserName?: string;
  StaffName?: string;
  cost?: number;
  internalCosting?: number;
}

export interface WorkGuruApiResponse<T> {
  result?: T | { items: T[] };
  items?: T[];
  success?: boolean;
}

export class WorkGuruClient {
  private token: string | null = null;

  constructor(private apiKey: string, private apiSecret: string) {}

  private logRequest(url: string, method: string, params?: any) {
    console.log(`[WorkGuru API] Request: ${method} ${url}${params ? ' ?' + JSON.stringify(params) : ''}`);
  }

  private logResponse(url: string, status: number, data: any) {
    // Mask sensitive data in response logging
    const maskedData = data && typeof data === 'object' ? { ...data } : { data };
    if (maskedData.result?.token || maskedData.token) {
        maskedData.token = '********';
    }
    console.log(`[WorkGuru API] Response: ${status} ${url}`, JSON.stringify(maskedData).substring(0, 500));
  }

  async authenticate() {
    const url = 'https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth';
    this.logRequest(url, 'POST');
    
    try {
      const response = await axios.post(url, {
        apiKey: this.apiKey,
        secret: this.apiSecret,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      const token = data.accessToken;
      const tokenReceived = typeof token === 'string' && token.length > 0;
      
      this.logResponse(url, response.status, { accessTokenReceived: tokenReceived });
      
      if (!tokenReceived) {
          throw new Error('Authentication failed. No token returned.');
      }
      
      this.token = token;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      this.logResponse(url, status || 0, data || error.message);
      
      const message = typeof data === 'string' ? data : data?.error?.message || data?.Message || data?.message || error.message;
      
      const detailedError = new Error(`WorkGuru Authentication failed (${status || 'unknown'})`) as Error & { status?: number; apiMessage?: string };
      detailedError.status = status;
      detailedError.apiMessage = message;
      throw detailedError;
    }
  }

  private async getAuthHeader() {
    if (!this.token) {
      await this.authenticate();
    }
    return { 
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
    };
  }

  async getProjects() {
    const url = `${BASE_URL}/api/services/app/Project/GetAllCurrentProjects`;
    const headers = await this.getAuthHeader();
    const params = { MaxResultCount: 1000 };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getAllProjects() {
    const url = `${BASE_URL}/api/services/app/Project/GetAllProjects`;
    const headers = await this.getAuthHeader();
    const params = { MaxResultCount: 5000 };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getClients() {
    const url = `${BASE_URL}/api/services/app/Client/GetClients`;
    const headers = await this.getAuthHeader();
    const params = { MaxResultCount: 1000 };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getProjectTasks(projectId: string) {
    const url = `${BASE_URL}/api/services/app/Project/GetAllTasksByProjectId`;
    const headers = await this.getAuthHeader();
    const params = { id: projectId };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getProjectTimeEntries(projectId: string) {
    const url = `${BASE_URL}/api/services/app/TimeSheet/GetTimeSheets`;
    const headers = await this.getAuthHeader();
    const params = { projectId, MaxResultCount: 1000 };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getProjectDetails(projectId: string) {
    const url = `${BASE_URL}/api/services/app/Project/GetProjectById`;
    const headers = await this.getAuthHeader();
    const params = { id: projectId };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getProjectPurchaseOrders(projectId: string) {
    const url = `${BASE_URL}/api/services/app/PurchaseOrder/GetPurchaseOrders`;
    const headers = await this.getAuthHeader();
    const params = { projectId, MaxResultCount: 1000 };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }

  async getProjectInvoices(projectId: string) {
    const url = `${BASE_URL}/api/services/app/Invoice/GetInvoices`;
    const headers = await this.getAuthHeader();
    const params = { projectId, MaxResultCount: 1000 };
    this.logRequest(url, 'GET', params);
    
    try {
      const response = await axios.get(url, { headers, params });
      this.logResponse(url, response.status, response.data);
      return response.data;
    } catch (error: any) {
      this.logResponse(url, error.response?.status || 0, error.response?.data || error.message);
      throw error;
    }
  }
}
