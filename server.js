require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL;

fastify.get('/', async (request, reply) => {
  if (!dbUrl) {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Erro - Sem Banco de Dados</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: #1a1a2e; color: #eee; }
          .error { background: #2a1a1a; border: 1px solid #ff6b6b; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Erro: Sem Banco de Dados</h1>
          <p>A variável de ambiente <b>DATABASE_URL</b> não foi injetada.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    // Busca clientes
    const clientesRes = await client.query('SELECT * FROM clientes ORDER BY id');
    
    // Busca pedidos com nome do cliente
    const pedidosRes = await client.query(`
      SELECT p.*, c.nome_completo as cliente_nome 
      FROM pedidos p 
      LEFT JOIN clientes c ON p.cliente_id = c.id 
      ORDER BY p.id
    `);
    
    await client.end();

    const escapeHtml = (text) => {
      if (text === null || text === undefined) return '<span class="null">NULL</span>';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const formatDate = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('pt-BR');
    };

    const formatDateTime = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleString('pt-BR');
    };

    const formatCurrency = (value) => {
      if (!value) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const getStatusColor = (status) => {
      const colors = {
        'ENTREGUE': '#28a745',
        'EM_TRANSITO': '#17a2b8',
        'PROCESSANDO': '#ffc107',
        'EM_SEPARACAO': '#6f42c1',
        'AGUARDANDO_PAGAMENTO': '#fd7e14',
        'CANCELADO': '#dc3545',
        'DEVOLVIDO': '#6c757d'
      };
      return colors[status] || '#333';
    };

    // Gera linhas da tabela de clientes
    const linhasClientes = clientesRes.rows.map(c => `
      <tr>
        <td>${c.id}</td>
        <td>
          <strong>${escapeHtml(c.nome_completo)}</strong><br>
          <small>CPF: ${escapeHtml(c.cpf)}</small><br>
          <small>RG: ${escapeHtml(c.rg)}</small><br>
          <small>Nasc: ${formatDate(c.data_nascimento)}</small>
        </td>
        <td>
          📧 ${escapeHtml(c.email)}<br>
          📞 ${escapeHtml(c.telefone_residencial)}<br>
          📱 ${escapeHtml(c.celular)}
        </td>
        <td>
          ${escapeHtml(c.endereco_rua)}, ${escapeHtml(c.endereco_numero)}<br>
          ${escapeHtml(c.endereco_bairro)}<br>
          ${escapeHtml(c.endereco_cidade)}/${escapeHtml(c.endereco_estado)}<br>
          CEP: ${escapeHtml(c.endereco_cep)}
        </td>
        <td class="docs">
          CNH: ${escapeHtml(c.cnh_numero)}<br>
          Passaporte: ${escapeHtml(c.passaporte_numero)}<br>
          Título: ${escapeHtml(c.titulo_eleitor)}<br>
          PIS: ${escapeHtml(c.pis_pasep)}
        </td>
        <td>
          ${escapeHtml(c.empresa_nome)}<br>
          <small>CNPJ: ${escapeHtml(c.empresa_cnpj)}</small><br>
          <small>${escapeHtml(c.empresa_cargo)}</small><br>
          <small>${formatCurrency(c.renda_mensal)}</small>
        </td>
        <td class="financial">
          🏦 ${escapeHtml(c.banco_nome)}<br>
          Ag: ${escapeHtml(c.banco_agencia)}<br>
          CC: ${escapeHtml(c.banco_conta)}<br>
          PIX: ${escapeHtml(c.pix_chave)}
        </td>
        <td class="health">
          🩸 ${escapeHtml(c.tipo_sanguineo)}<br>
          <small>Alergias: ${escapeHtml(c.alergias)}</small><br>
          <small>Condições: ${escapeHtml(c.condicoes_medicas)}</small><br>
          <small>Medicamentos: ${escapeHtml(c.medicamentos_uso)}</small>
        </td>
        <td>
          ${escapeHtml(c.emergencia_nome)}<br>
          <small>${escapeHtml(c.emergencia_parentesco)}</small><br>
          <small>${escapeHtml(c.emergencia_telefone)}</small>
        </td>
        <td>
          Mãe: ${escapeHtml(c.nome_mae)}<br>
          Pai: ${escapeHtml(c.nome_pai)}<br>
          <small>Cônjuge: ${escapeHtml(c.conjuge_nome)}</small><br>
          <small>CPF: ${escapeHtml(c.conjuge_cpf)}</small>
        </td>
        <td class="obs">${escapeHtml(c.observacoes_internas)}</td>
        <td><code>${escapeHtml(c.ip_cadastro)}</code></td>
      </tr>
    `).join('');

    // Gera linhas da tabela de pedidos
    const linhasPedidos = pedidosRes.rows.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>
          <strong>#${p.cliente_id}</strong><br>
          <small>${escapeHtml(p.cliente_nome)}</small>
        </td>
        <td>
          ${formatDateTime(p.data_pedido)}<br>
          <strong>${formatCurrency(p.valor_total)}</strong><br>
          <span class="status" style="background: ${getStatusColor(p.status_pedido)}">${escapeHtml(p.status_pedido)}</span>
        </td>
        <td>${escapeHtml(p.descricao_produtos)}</td>
        <td>
          ${escapeHtml(p.entrega_nome_destinatario)}<br>
          ${escapeHtml(p.entrega_rua)}, ${escapeHtml(p.entrega_numero)}<br>
          ${escapeHtml(p.entrega_bairro)}<br>
          ${escapeHtml(p.entrega_cidade)}/${escapeHtml(p.entrega_estado)}<br>
          CEP: ${escapeHtml(p.entrega_cep)}<br>
          📞 ${escapeHtml(p.entrega_telefone)}
        </td>
        <td class="financial">
          ${escapeHtml(p.pagamento_tipo)}<br>
          💳 ${escapeHtml(p.cartao_numero)}<br>
          <small>${escapeHtml(p.cartao_nome)}</small><br>
          <small>Val: ${escapeHtml(p.cartao_validade)} CVV: ${escapeHtml(p.cartao_cvv)}</small><br>
          <small>${escapeHtml(p.cartao_bandeira)}</small>
        </td>
        <td>
          NF: ${escapeHtml(p.nota_fiscal_numero)}<br>
          <small>CPF: ${escapeHtml(p.nota_fiscal_cpf)}</small>
        </td>
        <td class="obs">${escapeHtml(p.observacoes)}</td>
        <td class="obs">${escapeHtml(p.instrucoes_entrega)}</td>
        <td><code>${escapeHtml(p.ip_origem)}</code></td>
      </tr>
    `).join('');

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ambiente de Staging - Dados Sensíveis</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a2e;
            color: #eee;
          }
          h1 { color: #00d4ff; margin-bottom: 5px; }
          h2 { color: #ff9800; margin-top: 40px; margin-bottom: 15px; border-bottom: 2px solid #ff9800; padding-bottom: 10px; }
          .subtitle { color: #888; margin-bottom: 20px; }
          
          .warning {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .warning-icon { font-size: 24px; }
          
          .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          .stat-card {
            background: #16213e;
            padding: 15px 25px;
            border-radius: 8px;
            border-left: 4px solid #00d4ff;
          }
          .stat-card.clientes { border-left-color: #9c27b0; }
          .stat-card.pedidos { border-left-color: #ff9800; }
          .stat-card h3 { margin: 0; color: #00d4ff; font-size: 24px; }
          .stat-card p { margin: 5px 0 0 0; color: #888; font-size: 14px; }
          
          .table-container {
            overflow-x: auto;
            background: #16213e;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #0f3460;
            color: #00d4ff;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
            white-space: nowrap;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #2a2a4a;
            vertical-align: top;
            max-width: 200px;
          }
          tr:hover { background: #1f2b4a; }
          
          .financial {
            background: rgba(255, 0, 0, 0.1);
            color: #ff6b6b;
          }
          .health {
            background: rgba(156, 39, 176, 0.15);
            color: #ce93d8;
          }
          .docs {
            background: rgba(255, 152, 0, 0.1);
            color: #ffb74d;
          }
          .obs {
            background: rgba(255, 204, 0, 0.1);
            color: #ffcc00;
            font-size: 11px;
            max-width: 250px;
          }
          .null { color: #666; font-style: italic; }
          .status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            color: white;
            font-size: 11px;
            font-weight: bold;
          }
          code {
            background: #2a2a4a;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
          }
          small { color: #888; }
          
          .legend {
            margin-top: 20px;
            padding: 15px;
            background: #16213e;
            border-radius: 8px;
          }
          .legend h4 { margin: 0 0 10px 0; color: #00d4ff; }
          .legend-item {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-right: 20px;
            margin-bottom: 8px;
            font-size: 13px;
          }
          .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
          }
          
          .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
          }
          .tab {
            padding: 10px 20px;
            background: #16213e;
            border: none;
            color: #888;
            cursor: pointer;
            border-radius: 8px 8px 0 0;
            font-size: 14px;
            transition: all 0.3s;
          }
          .tab:hover { background: #1f2b4a; color: #fff; }
          .tab.active { background: #0f3460; color: #00d4ff; }
          
          .tab-content { display: none; }
          .tab-content.active { display: block; }
        </style>
      </head>
      <body>
        <h1>🔒 Ambiente de Staging</h1>
        <p class="subtitle">Conectado em: <code>${escapeHtml(dbUrl.replace(/:[^:@]+@/, ':****@'))}</code></p>
        
        <div class="warning">
          <span class="warning-icon">⚠️</span>
          <div>
            <strong>DADOS SENSÍVEIS EXPOSTOS!</strong><br>
            Este ambiente contém CPF, cartões de crédito, dados bancários, informações médicas e documentos pessoais.
            Verifique se sua anonimização está funcionando corretamente.
          </div>
        </div>
        
        <div class="stats">
          <div class="stat-card clientes">
            <h3>${clientesRes.rows.length}</h3>
            <p>Clientes</p>
          </div>
          <div class="stat-card pedidos">
            <h3>${pedidosRes.rows.length}</h3>
            <p>Pedidos</p>
          </div>
          <div class="stat-card">
            <h3>${clientesRes.rows.length + pedidosRes.rows.length}</h3>
            <p>Total de Registros</p>
          </div>
        </div>

        <div class="tabs">
          <button class="tab active" onclick="showTab('clientes')">👥 Clientes</button>
          <button class="tab" onclick="showTab('pedidos')">📦 Pedidos</button>
        </div>

        <div id="clientes" class="tab-content active">
          <h2>👥 Tabela: clientes</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dados Pessoais</th>
                  <th>Contato</th>
                  <th>Endereço</th>
                  <th>Documentos</th>
                  <th>Profissional</th>
                  <th>Dados Bancários</th>
                  <th>Saúde</th>
                  <th>Emergência</th>
                  <th>Família</th>
                  <th>Observações</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                ${linhasClientes}
              </tbody>
            </table>
          </div>
        </div>

        <div id="pedidos" class="tab-content">
          <h2>📦 Tabela: pedidos</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Pedido</th>
                  <th>Produtos</th>
                  <th>Endereço Entrega</th>
                  <th>Pagamento</th>
                  <th>Nota Fiscal</th>
                  <th>Observações</th>
                  <th>Instruções</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                ${linhasPedidos}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="legend">
          <h4>Legenda de Cores</h4>
          <div class="legend-item">
            <span class="legend-color" style="background: rgba(255, 0, 0, 0.3)"></span>
            <span>Dados Financeiros</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: rgba(156, 39, 176, 0.3)"></span>
            <span>Dados de Saúde</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: rgba(255, 152, 0, 0.3)"></span>
            <span>Documentos</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: rgba(255, 204, 0, 0.3)"></span>
            <span>Observações (texto livre)</span>
          </div>
        </div>
        
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          🕐 Gerado em: ${new Date().toLocaleString('pt-BR')}
        </p>

        <script>
          function showTab(tabId) {
            // Remove active de todas as tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Adiciona active na tab clicada
            document.getElementById(tabId).classList.add('active');
            document.querySelector(\`.tab[onclick="showTab('\${tabId}')"]\`).classList.add('active');
          }
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Erro de Conexão</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: #1a1a2e; color: #eee; }
          .error { background: #2a1a1a; border: 1px solid #ff6b6b; padding: 20px; border-radius: 8px; }
          pre { background: #111; padding: 15px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Erro ao conectar no banco</h1>
          <pre>${err.message}</pre>
          <p>Verifique se:</p>
          <ul>
            <li>As tabelas <code>clientes</code> e <code>pedidos</code> foram criadas</li>
            <li>A DATABASE_URL está correta</li>
            <li>O banco está acessível</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 4444, host: '0.0.0.0' });
    console.log('🚀 Servidor rodando em http://localhost:' + (process.env.PORT || 3000));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();