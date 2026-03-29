import axios from 'axios';

const BASE_URL = 'https://api.workguru.io';

export class WorkGuruClient {
  private token: string | null = null;

  constructor(private apiKey: string, private apiSecret: string) {}

  private logRequest(url: string, method: string) {
    console.log(`[WorkGuru API] Request: ${method} ${url}`);
  }

  private logResponse(url: string, status: number, data: any) {
    // Mask sensitive data in response logging
    const maskedData = { ...data };
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
      
      const detailedError: any = new Error(`WorkGuru Authentication failed (${status || 'unknown'})`);
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
    this.logRequest(url, 'GET');
    
    try {
      const response = await axios.get(url, { headers, params: { MaxResultCount: 1000 } });
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
    this.logRequest(url, 'GET');
    
    try {
      const response = await axios.get(url, { headers, params: { MaxResultCount: 5000 } });
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
    this.logRequest(url, 'GET');
    
    try {
      const response = await axios.get(url, { headers, params: { MaxResultCount: 1000 } });
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
    this.logRequest(url, 'GET');
    
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
    this.logRequest(url, 'GET');
    
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
