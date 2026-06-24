// ====================================
// api.js - Local Backend API Client
// ====================================

const API = {
  BASE_URL: "http://127.0.0.1:5000",
  available: false,
  checked: false,

  async check() {
    if (this.checked) return this.available;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const resp = await fetch(this.BASE_URL + "/health", {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      this.available = resp.ok;
    } catch (e) {
      this.available = false;
    }
    this.checked = true;
    return this.available;
  },

  reset() {
    this.checked = false;
    this.available = false;
  },

  async request(method, path, body = null) {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    };
    if (body) options.body = JSON.stringify(body);

    const resp = await fetch(this.BASE_URL + path, options);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    return resp.status === 204 ? null : await resp.json();
  },

  async listEntries() {
    return await this.request("GET", "/api/entries");
  },

  async createEntry(entry) {
    return await this.request("POST", "/api/entries", entry);
  },

  async updateEntry(id, entry) {
    return await this.request("PUT", `/api/entries/${id}`, entry);
  },

  async deleteEntry(id) {
    return await this.request("DELETE", `/api/entries/${id}`);
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const resp = await fetch(this.BASE_URL + "/api/upload", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    return await resp.json();
  },

  async deploy(config = {}) {
    return await this.request("POST", "/api/deploy", config);
  },
};
