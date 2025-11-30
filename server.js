require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const { Client } = require('pg');

// Pega a URL que o seu SaaS injetou
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
          body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
          .error { background: #fee; border: 1px solid #c00; padding: 20px; border-radius: 8px; }
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
    
    // Busca os pedidos da tabela
    const res = await client.query(`
      SELECT 
        id,
        nome_completo,
        cpf,
        rg,
        data_nascimento,
        email,
        telefone,
        celular,
        endereco_rua,
        endereco_numero,
        endereco_cidade,
        endereco_estado,
        endereco_cep,
        numero_cartao,
        nome_cartao,
        validade_cartao,
        cvv_cartao,
        banco,
        agencia,
        conta_corrente,
        data_pedido,
        valor_total,
        status_pedido,
        descricao_produtos,
        observacoes,
        ip_origem
      FROM pedidos 
      ORDER BY id
    `);
    await client.end();

    // Função para formatar data
    const formatDate = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('pt-BR');
    };

    // Função para formatar data/hora
    const formatDateTime = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleString('pt-BR');
    };

    // Função para formatar valor
    const formatCurrency = (value) => {
      if (!value) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Função para escapar HTML
    const escapeHtml = (text) => {
      if (!text) return '-';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    // Função para definir cor do status
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

    // Gera as linhas da tabela
    const linhas = res.rows.map(pedido => `
      <tr>
        <td>${pedido.id}</td>
        <td>
          <strong>${escapeHtml(pedido.nome_completo)}</strong><br>
          <small>CPF: ${escapeHtml(pedido.cpf)}</small><br>
          <small>RG: ${escapeHtml(pedido.rg)}</small><br>
          <small>Nasc: ${formatDate(pedido.data_nascimento)}</small>
        </td>
        <td>
          📧 ${escapeHtml(pedido.email)}<br>
          📞 ${escapeHtml(pedido.telefone)}<br>
          📱 ${escapeHtml(pedido.celular)}
        </td>
        <td>
          ${escapeHtml(pedido.endereco_rua)}, ${escapeHtml(pedido.endereco_numero)}<br>
          ${escapeHtml(pedido.endereco_cidade)}/${escapeHtml(pedido.endereco_estado)}<br>
          CEP: ${escapeHtml(pedido.endereco_cep)}
        </td>
        <td class="sensitive">
          💳 ${escapeHtml(pedido.numero_cartao)}<br>
          <small>${escapeHtml(pedido.nome_cartao)}</small><br>
          <small>Val: ${escapeHtml(pedido.validade_cartao)} CVV: ${escapeHtml(pedido.cvv_cartao)}</small>
        </td>
        <td>
          🏦 ${escapeHtml(pedido.banco) || '-'}<br>
          <small>Ag: ${escapeHtml(pedido.agencia) || '-'}</small><br>
          <small>CC: ${escapeHtml(pedido.conta_corrente) || '-'}</small>
        </td>
        <td>
          ${formatDateTime(pedido.data_pedido)}<br>
          <strong>${formatCurrency(pedido.valor_total)}</strong><br>
          <span class="status" style="background: ${getStatusColor(pedido.status_pedido)}">${escapeHtml(pedido.status_pedido)}</span>
        </td>
        <td>${escapeHtml(pedido.descricao_produtos)}</td>
        <td class="observacoes">${escapeHtml(pedido.observacoes)}</td>
        <td><code>${escapeHtml(pedido.ip_origem)}</code></td>
      </tr>
    `).join('');

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ambiente de Staging - Pedidos</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a2e;
            color: #eee;
          }
          h1 {
            color: #00d4ff;
            margin-bottom: 5px;
          }
          .subtitle {
            color: #888;
            margin-bottom: 20px;
          }
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
          .warning-icon {
            font-size: 24px;
          }
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
          .stat-card h3 {
            margin: 0;
            color: #00d4ff;
            font-size: 24px;
          }
          .stat-card p {
            margin: 5px 0 0 0;
            color: #888;
            font-size: 14px;
          }
          .table-container {
            overflow-x: auto;
            background: #16213e;
            border-radius: 8px;
            padding: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background: #0f3460;
            color: #00d4ff;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #2a2a4a;
            vertical-align: top;
          }
          tr:hover {
            background: #1f2b4a;
          }
          .sensitive {
            background: rgba(255, 0, 0, 0.1);
            color: #ff6b6b;
          }
          .observacoes {
            max-width: 250px;
            font-size: 11px;
            color: #ffcc00;
            background: rgba(255, 204, 0, 0.1);
          }
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
          small {
            color: #888;
          }
          .legend {
            margin-top: 20px;
            padding: 15px;
            background: #16213e;
            border-radius: 8px;
          }
          .legend h4 {
            margin: 0 0 10px 0;
            color: #00d4ff;
          }
          .legend-item {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            margin-right: 15px;
            font-size: 12px;
          }
          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <h1>🔒 Ambiente de Staging - Teste de Anonimização</h1>
        <p class="subtitle">Conectado em: <code>${escapeHtml(dbUrl.replace(/:[^:@]+@/, ':****@'))}</code></p>
        
        <div class="warning">
          <span class="warning-icon">⚠️</span>
          <div>
            <strong>DADOS SENSÍVEIS EXPOSTOS!</strong><br>
            Esta tabela contém CPF, cartões de crédito, dados bancários e informações médicas. 
            Verifique se sua anonimização está funcionando corretamente.
          </div>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>${res.rows.length}</h3>
            <p>Total de Pedidos</p>
          </div>
          <div class="stat-card">
            <h3>${res.rows.filter(p => p.numero_cartao).length}</h3>
            <p>Cartões Expostos</p>
          </div>
          <div class="stat-card">
            <h3>${res.rows.filter(p => p.cpf).length}</h3>
            <p>CPFs Expostos</p>
          </div>
          <div class="stat-card">
            <h3>${res.rows.filter(p => p.observacoes && p.observacoes.length > 0).length}</h3>
            <p>Obs. com Dados Sensíveis</p>
          </div>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dados Pessoais</th>
                <th>Contato</th>
                <th>Endereço</th>
                <th>💳 Cartão</th>
                <th>🏦 Banco</th>
                <th>Pedido</th>
                <th>Produtos</th>
                <th>⚠️ Observações</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              ${linhas}
            </tbody>
          </table>
        </div>
        
        <div class="legend">
          <h4>Legenda de Status</h4>
          <span class="legend-item"><span class="legend-color" style="background: #28a745"></span> Entregue</span>
          <span class="legend-item"><span class="legend-color" style="background: #17a2b8"></span> Em Trânsito</span>
          <span class="legend-item"><span class="legend-color" style="background: #ffc107"></span> Processando</span>
          <span class="legend-item"><span class="legend-color" style="background: #6f42c1"></span> Em Separação</span>
          <span class="legend-item"><span class="legend-color" style="background: #fd7e14"></span> Aguardando Pagamento</span>
          <span class="legend-item"><span class="legend-color" style="background: #dc3545"></span> Cancelado</span>
          <span class="legend-item"><span class="legend-color" style="background: #6c757d"></span> Devolvido</span>
        </div>
        
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          🕐 Gerado em: ${new Date().toLocaleString('pt-BR')} | 
          Campos em <span style="color: #ff6b6b">vermelho</span> = dados financeiros | 
          Campos em <span style="color: #ffcc00">amarelo</span> = observações sensíveis
        </p>
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
          <pre>${escapeHtml(err.message)}</pre>
          <p>Verifique se:</p>
          <ul>
            <li>A tabela <code>pedidos</code> foi criada</li>
            <li>A DATABASE_URL está correta</li>
            <li>O banco está acessível</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  }
});

// Função auxiliar para escapar HTML em erros
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// O SaaS precisa expor a porta definida no env PORT ou 3000
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 4444, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();