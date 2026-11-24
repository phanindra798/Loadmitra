// PM2 process list for the single EC2 instance. All three bind to localhost;
// nginx is the only public listener. Memory caps keep a 1 GB t3.micro stable.
module.exports = {
  apps: [
    {
      name: "loadmitra-api",
      cwd: "/opt/loadmitra/server",
      script: "dist/index.js",
      env: { NODE_ENV: "production" }, // remaining settings come from /opt/loadmitra/server/.env
      max_memory_restart: "300M",
      kill_timeout: 10000, // the API drains requests for up to 8 s on restart
      time: true,
    },
    {
      name: "loadmitra-shipper",
      cwd: "/opt/loadmitra/shipper",
      script: ".output/server/index.mjs",
      env: { NODE_ENV: "production", HOST: "127.0.0.1", PORT: "8080" },
      max_memory_restart: "250M",
      time: true,
    },
    {
      name: "loadmitra-captain",
      cwd: "/opt/loadmitra/captain",
      script: ".output/server/index.mjs",
      env: { NODE_ENV: "production", HOST: "127.0.0.1", PORT: "8081" },
      max_memory_restart: "250M",
      time: true,
    },
  ],
};
