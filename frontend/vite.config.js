import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend EC2 instance serves this build (or runs `vite preview`)
// behind the external load balancer. The API base URL points at the
// internal load balancer's DNS name so traffic never leaves the VPC.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 4173
  }
});
