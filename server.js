require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL;

// ============================================
// Regras de validação de anonimização
// ============================================
const anonValidators = {
  // Identificação pessoal
  nome_completo: (val) => !val || /^anon/i.test(val) || val === 'ANONIMIZADO',
  name: (val) => !val || /^anon/i.test(val) || val === 'ANONIMIZADO',
  full_name: (val) => !val || /^anon/i.test(val) || val === 'ANONIMIZADO',
  
  cpf: (val) => !val || /^0{3}\.0{3}\.0{3}-0{2}$/.test(val) || /^\*+$/.test(val),
  
  rg: (val) => !val || /^0{2}\.0{3}\.0{3}-0$/.test(val) || /^\*+$/.test(val) || val === '00.000.000-0',
  identidade: (val) => !val || /^0+/.test(val),
  
  data_nascimento: (val) => {
    if (!val) return true;
    const date = new Date(val);
    // Considera anonimizado se for 01/01 de qualquer ano (data fixa)
    return date.getDate() === 1 && date.getMonth() === 0;
  },
  
  // Contato
  email: (val) => !val || /^anon[_-]?\d*@/i.test(val) || /@(staging|test|anonimizado|example)\./i.test(val),
  
  telefone: (val) => !val || /^\(0{2}\)\s?0{4}-0{4}$/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  phone: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  fone: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  
  celular: (val) => !val || /^\(0{2}\)\s?0{5}-0{4}$/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  mobile: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  
  // Endereço
  endereco_rua: (val) => !val || /anonimizad/i.test(val) || /^rua\s+0+$/i.test(val),
  street: (val) => !val || /anon/i.test(val),
  logradouro: (val) => !val || /anonimizad/i.test(val),
  
  endereco_numero: (val) => !val || /^0+$/.test(val),
  numero: (val) => !val || /^0+$/.test(val),
  number: (val) => !val || /^0+$/.test(val),
  
  endereco_complemento: (val) => !val || val === 'NULL' || /anonimizad/i.test(val) || /^apto\s*0+$/i.test(val),
  complemento: (val) => !val || /anon/i.test(val),
  
  endereco_bairro: (val) => !val || /anonimizad/i.test(val),
  bairro: (val) => !val || /anonimizad/i.test(val),
  
  endereco_cep: (val) => !val || /^0{5}-0{3}$/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  cep: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  zip: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  
  // Dados financeiros
  numero_cartao: (val) => !val || /^\*+/.test(val) || /^0+$/.test(val.replace(/\D/g, '')) || /^\*{4}\s\*{4}\s\*{4}\s\d{4}$/.test(val),
  cartao: (val) => !val || /^\*+/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  card: (val) => !val || /^\*+/.test(val),
  
  nome_cartao: (val) => !val || /anonimizad/i.test(val) || /^\*+$/.test(val),
  card_name: (val) => !val || /anon/i.test(val),
  titular: (val) => !val || /anon/i.test(val),
  
  validade_cartao: (val) => !val || /^0{2}\/0{4}$/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  validade: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  expiry: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  
  cvv_cartao: (val) => !val || /^\*{3}$/.test(val) || /^0{3}$/.test(val),
  cvv: (val) => !val || /^\*+$/.test(val) || /^0+$/.test(val),
  cvc: (val) => !val || /^\*+$/.test(val) || /^0+$/.test(val),
  
  agencia: (val) => !val || /^0{4}-0$/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  agency: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  
  conta_corrente: (val) => !val || /^0{5}-0$/.test(val) || /^0+$/.test(val.replace(/\D/g, '')),
  conta: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  account: (val) => !val || /^0+$/.test(val.replace(/\D/g, '')),
  
  // Dados técnicos
  ip_origem: (val) => !val || val === '0.0.0.0' || val === '127.0.0.1' || /^0\.0\.0\.0$/.test(val),
  ip: (val) => !val || val === '0.0.0.0',
  ip_address: (val) => !val || val === '0.0.0.0',
  
  // Texto livre - verifica se contém dados sensíveis
  observacoes: (val) => {
    if (!val) return true;
    const patterns = [
      /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF real
      /\(\d{2}\)\s?\d{4,5}-\d{4}/, // Telefone real
      /CRM-[A-Z]{2}\s?\d{4,6}/i,   // CRM real
      /OAB[/-][A-Z]{2}\s?\d{4,6}/i, // OAB real
      /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/, // Processo judicial
      /HIV|diabétic|grávida|medicamento|diagnóstico|Sertralina|Clonazepam|Metformina|Biktarvy/i, // Termos médicos
    ];
    // Retorna true (anonimizado) se NÃO encontrar nenhum padrão sensível
    return !patterns.some(p => p.test(val));
  },
  obs: (val) => anonValidators.observacoes(val),
  notes: (val) => anonValidators.observacoes(val),
  comments: (val) => anonValidators.observacoes(val),
  anotacoes: (val) => anonValidators.observacoes(val),
};

// Campos que precisam ser anonimizados (para identificar na tabela)
const sensitiveFields = [
  'nome_completo', 'name', 'full_name',
  'cpf', 'rg', 'identidade',
  'data_nascimento', 'birth',
  'email',
  'telefone', 'phone', 'fone', 'celular', 'mobile',
  'endereco_rua', 'street', 'logradouro',
  'endereco_numero', 'numero', 'number',
  'endereco_complemento', 'complemento',
  'endereco_bairro', 'bairro',
  'endereco_cep', 'cep', 'zip',
  'numero_cartao', 'cartao', 'card',
  'nome_cartao', 'card_name', 'titular',
  'validade_cartao', 'validade', 'expiry',
  'cvv_cartao', 'cvv', 'cvc',
  'agencia', 'agency',
  'conta_corrente', 'conta', 'account',
  'ip_origem', 'ip', 'ip_address',
  'observacoes', 'obs', 'notes', 'comments', 'anotacoes'
];

// Verifica se um campo é sensível
const isSensitiveField = (fieldName) => {
  const lower = fieldName.toLowerCase();
  return sensitiveFields.some(sf => lower.includes(sf));
};

// Obtém o validador apropriado para um campo
const getValidator = (fieldName) => {
  const lower = fieldName.toLowerCase();
  for (const [key, validator] of Object.entries(anonValidators)) {
    if (lower.includes(key)) {
      return validator;
    }
  }
  return null;
};

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
    
    const res = await client.query('SELECT * FROM pedidos ORDER BY id');
    await client.end();

    const escapeHtml = (text) => {
      if (text === null || text === undefined) return '<span class="null">NULL</span>';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    // Análise de anonimização
    let totalFields = 0;
    let anonFields = 0;
    let exposedFields = 0;
    
    const columns = res.rows.length > 0 ? Object.keys(res.rows[0]) : [];
    const sensitiveColumns = columns.filter(isSensitiveField);

    // Gera as linhas da tabela com validação
    const linhas = res.rows.map((row, rowIndex) => {
      const cells = columns.map(col => {
        const value = row[col];
        const isSensitive = isSensitiveField(col);
        const validator = getValidator(col);
        
        let status = '';
        let cellClass = '';
        
        if (isSensitive) {
          totalFields++;
          if (validator) {
            const isAnon = validator(value);
            if (isAnon) {
              anonFields++;
              status = '✅';
              cellClass = 'anon-ok';
            } else {
              exposedFields++;
              status = '❌';
              cellClass = 'anon-fail';
            }
          }
        }
        
        // Trunca valores longos
        let displayValue = escapeHtml(value);
        if (value && String(value).length > 50) {
          displayValue = `<span title="${escapeHtml(value)}">${escapeHtml(String(value).substring(0, 47))}...</span>`;
        }
        
        return `<td class="${cellClass}">${status} ${displayValue}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');

    // Cabeçalho com indicação de campo sensível
    const headerCells = columns.map(col => {
      const isSensitive = isSensitiveField(col);
      return `<th class="${isSensitive ? 'sensitive-header' : ''}">${col}${isSensitive ? ' 🔒' : ''}</th>`;
    }).join('');

    const percentAnon = totalFields > 0 ? ((anonFields / totalFields) * 100).toFixed(1) : 0;
    const statusColor = percentAnon == 100 ? '#28a745' : percentAnon >= 50 ? '#ffc107' : '#dc3545';
    const statusText = percentAnon == 100 ? 'TOTALMENTE ANONIMIZADO' : percentAnon >= 50 ? 'PARCIALMENTE ANONIMIZADO' : 'DADOS EXPOSTOS';

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Validador de Anonimização</title>
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
          .subtitle { color: #888; margin-bottom: 20px; }
          
          .status-banner {
            background: ${statusColor};
            color: ${percentAnon >= 50 && percentAnon < 100 ? '#000' : '#fff'};
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .status-banner h2 { margin: 0 0 10px 0; }
          .status-banner .percent { font-size: 48px; font-weight: bold; }
          
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
            flex: 1;
            min-width: 150px;
          }
          .stat-card.ok { border-left: 4px solid #28a745; }
          .stat-card.fail { border-left: 4px solid #dc3545; }
          .stat-card.info { border-left: 4px solid #00d4ff; }
          .stat-card h3 { margin: 0; font-size: 28px; }
          .stat-card p { margin: 5px 0 0 0; color: #888; font-size: 14px; }
          
          .legend {
            background: #16213e;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
          }
          .legend-item { display: flex; align-items: center; gap: 8px; }
          .legend-icon { font-size: 18px; }
          
          .table-container {
            overflow-x: auto;
            background: #16213e;
            border-radius: 8px;
            padding: 10px;
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
          th.sensitive-header {
            background: #3d0f60;
            color: #ff9800;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #2a2a4a;
            vertical-align: top;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          tr:hover { background: #1f2b4a; }
          
          .anon-ok {
            background: rgba(40, 167, 69, 0.15);
          }
          .anon-fail {
            background: rgba(220, 53, 69, 0.25);
            color: #ff6b6b;
          }
          .null { color: #666; font-style: italic; }
          
          .footer {
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>🔍 Validador de Anonimização</h1>
        <p class="subtitle">Verificando conformidade LGPD/GDPR na tabela <code>pedidos</code></p>
        
        <div class="status-banner">
          <h2>${statusText}</h2>
          <div class="percent">${percentAnon}%</div>
          <p>dos campos sensíveis estão anonimizados</p>
        </div>
        
        <div class="stats">
          <div class="stat-card info">
            <h3>${res.rows.length}</h3>
            <p>Registros analisados</p>
          </div>
          <div class="stat-card info">
            <h3>${sensitiveColumns.length}</h3>
            <p>Campos sensíveis detectados</p>
          </div>
          <div class="stat-card ok">
            <h3>${anonFields}</h3>
            <p>Campos anonimizados ✅</p>
          </div>
          <div class="stat-card fail">
            <h3>${exposedFields}</h3>
            <p>Campos expostos ❌</p>
          </div>
        </div>
        
        <div class="legend">
          <div class="legend-item">
            <span class="legend-icon">🔒</span>
            <span>Campo sensível (requer anonimização)</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon">✅</span>
            <span>Anonimizado corretamente</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon">❌</span>
            <span>Dado exposto (não anonimizado)</span>
          </div>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>
              ${linhas}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>🕐 Análise realizada em: ${new Date().toLocaleString('pt-BR')}</p>
          <p>Campos sensíveis verificados: ${sensitiveColumns.join(', ')}</p>
        </div>
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
        </div>
      </body>
      </html>
    `);
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    console.log('🚀 Servidor rodando em http://localhost:' + (process.env.PORT || 3000));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();