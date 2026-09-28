import type { NextConfig } from 'next';

// standalone: o build gera um server.js enxuto, usado pela imagem Docker do
// painel na rede local (maomaobuy-backend/deploy/admin-lan).
const nextConfig: NextConfig = { output: 'standalone' };

export default nextConfig;
