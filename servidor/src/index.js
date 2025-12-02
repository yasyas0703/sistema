import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';


// Funções para comunicar com o servidor - VERSÃO CORRIGIDA
const api = {
  // ✅ LOGIN JÁ FUNCIONANDO
  login: async (nome, senha) => {
    // ... (seu código atual permanece)
  },

  // ✅ CARREGAR PROCESSOS DO BANCO
  getProcessos: async () => {
    try {
      const res = await fetchAutenticado(`${API_URL}/processos`);
      if (!res.ok) throw new Error('Erro ao carregar processos');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao carregar processos:', error);
      throw error;
    }
  },

  // ✅ SALVAR PROCESSO NO BANCO
  salvarProcesso: async (processo) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/processos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processo)
      });
      
      if (!res.ok) throw new Error('Erro ao salvar processo');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao salvar processo:', error);
      throw error;
    }
  },

  // ✅ ATUALIZAR PROCESSO NO BANCO
  atualizarProcesso: async (id, processo) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/processos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processo)
      });
      
      if (!res.ok) throw new Error('Erro ao atualizar processo');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao atualizar processo:', error);
      throw error;
    }
  },

  // ✅ EXCLUIR PROCESSO DO BANCO
  excluirProcesso: async (id) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/processos/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Erro ao excluir processo');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao excluir processo:', error);
      throw error;
    }
  },

  // ✅ CARREGAR DEPARTAMENTOS DO BANCO
  getDepartamentos: async () => {
    try {
      const res = await fetchAutenticado(`${API_URL}/departamentos`);
      if (!res.ok) throw new Error('Erro ao carregar departamentos');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
      throw error;
    }
  },

  // ✅ SALVAR DEPARTAMENTO NO BANCO
  salvarDepartamento: async (departamento) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/departamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(departamento)
      });
      
      if (!res.ok) throw new Error('Erro ao salvar departamento');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao salvar departamento:', error);
      throw error;
    }
  },

  // ✅ ATUALIZAR DEPARTAMENTO NO BANCO
  atualizarDepartamento: async (id, departamento) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/departamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(departamento)
      });
      
      if (!res.ok) throw new Error('Erro ao atualizar departamento');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao atualizar departamento:', error);
      throw error;
    }
  },

  // ✅ EXCLUIR DEPARTAMENTO DO BANCO
  excluirDepartamento: async (id) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/departamentos/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Erro ao excluir departamento');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao excluir departamento:', error);
      throw error;
    }
  },

  // ✅ CRIAR USUÁRIO (register)
  criarUsuario: async (usuario) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/usuarios/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usuario)
      });
      
      if (!res.ok) throw new Error('Erro ao criar usuário');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  },

  // ✅ LISTAR USUÁRIOS
  getUsuarios: async () => {
    try {
      const res = await fetchAutenticado(`${API_URL}/usuarios`);
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      throw error;
    }
  }
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
