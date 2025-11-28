const fastify = require('fastify')({ logger: true });
const { Client } = require('pg');

// Pega a URL que o seu SaaS injetou
const dbUrl = process.env.DATABASE_URL;

fastify.get('/', async (request, reply) => {
  if (!dbUrl) {
    return reply.type('text/html').send(`
      <h1>Erro: Sem Banco de Dados</h1>
      <p>A variável de ambiente <b>DATABASE_URL</b> não foi injetada.</p>
    `);
  }

  try {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    // Tenta buscar usuários
    const res = await client.query('SELECT * FROM users LIMIT 5');
    await client.end();

    // Renderiza uma lista simples
    const lista = res.rows.map(user => `
      <li>
        <strong>ID:</strong> ${user.id} <br>
        <strong>Nome:</strong> ${user.name} <br>
        <strong>Email:</strong> ${user.email} (Deve estar anonimizado!)
      </li>
    `).join('');

    return reply.type('text/html').send(`
      <h1>Ambiente de Staging</h1>
      <p>Conectado em: ${dbUrl}</p>
      <h2>Usuários do Banco:</h2>
      <ul>${lista}</ul>
    `);

  } catch (err) {
    return reply.type('text/html').send(`<h1>Erro ao conectar no banco</h1><pre>${err.message}</pre>`);
  }
});

// O SaaS precisa expor a porta definida no env PORT ou 3000
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();