import axios from 'axios';

const BASE_URL = 'https://api.workguru.io/api/v1';

export class WorkGuruClient {
  private token: string | null = null;

  constructor(private apiKey: string, private apiSecret: string) {}

  async authenticate() {
    try {
      const response = await axios.post(`${BASE_URL}/TokenAuth`, {
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
      });
      this.token = response.data.token;
    } catch (error) {
      console.error('WorkGuru Authentication failed:', error);
      throw new Error('WorkGuru Authentication failed');
    }
  }

  private async getAuthHeader() {
    if (!this.token) {
      await this.authenticate();
    }
    return { Authorization: `Bearer ${this.token}` };
  }

  async getProjects(updatedSince?: Date) {
    const headers = await this.getAuthHeader();
    const params = updatedSince ? { updatedSince: updatedSince.toISOString() } : {};
    const response = await axios.get(`${BASE_URL}/projects`, { headers, params });
    return response.data;
  }

  async getClients() {
    const headers = await this.getAuthHeader();
    const response = await axios.get(`${BASE_URL}/clients`, { headers });
    return response.data;
  }

  async getProjectTasks(projectId: string) {
    const headers = await this.getAuthHeader();
    const response = await axios.get(`${BASE_URL}/projects/${projectId}/tasks`, { headers });
    return response.data;
  }

  async getTimeEntries(updatedSince?: Date) {
    const headers = await this.getAuthHeader();
    const params = updatedSince ? { updatedSince: updatedSince.toISOString() } : {};
    const response = await axios.get(`${BASE_URL}/timeentries`, { headers, params });
    return response.data;
  }
}
