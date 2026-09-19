module.exports = {
  apps: [
    {
      name: "reviewme",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3010",
      cwd: "/var/www/reviewme",
      instances: 1,
      autorestart: true,
      max_memory_restart: "750M",
      env: { NODE_ENV: "production", PORT: "3010" }
    }
  ]
};
