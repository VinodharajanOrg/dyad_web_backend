# Dyad Web Frontend

Dyad is a local, open-source AI app builder. It's fast, private, and fully under your control — like Lovable, v0, or Bolt, but running right on your machine.

[![Image](https://github.com/user-attachments/assets/f6c83dfc-6ffd-4d32-93dd-4b9c46d17790)](https://dyad.sh/)

More info at: [https://dyad.sh/](https://dyad.sh/)

## 📋 About This Repository

This is the **Next.js frontend** for Dyad Web. It requires a separate backend server to function.

**Backend:** The backend API server is maintained in a separate repository. Ensure it's running before starting the frontend.

## 🚀 Features

- ⚡️ **Local**: Fast, private and no lock-in.
- 🛠 **Bring your own keys**: Use your own AI API keys — no vendor lock-in.
- 🖥️ **Cross-platform**: Easy to run on Mac or Windows.
- 🌐 **Next.js 15**: Modern React framework with App Router

## 📦 Download

No sign-up required. Just download and go.

### [👉 Download for your platform](https://www.dyad.sh/#download)

## 🤝 Community

Join our growing community of AI app builders on **Reddit**: [r/dyadbuilders](https://www.reddit.com/r/dyadbuilders/) - share your projects and get help from the community!

## � Production Deployment with HTTPS

For production deployments with HTTPS support using Nginx reverse proxy, see our comprehensive guide:

**[HTTPS Setup Documentation](./docs/HTTPS_SETUP.md)**

Quick start:
```bash
# Generate SSL certificates
./scripts/generate-ssl-certs.sh

# Start with Docker Compose
docker-compose up -d
```

Access via HTTPS at `https://localhost`

## �🛠️ Contributing

**Dyad** is open-source (Apache 2.0 licensed).

If you're interested in contributing to dyad, please read our [contributing](./CONTRIBUTING.md) doc.

## License

- All the code in this repo outside of `src/pro` is open-source and licensed under Apache 2.0 - see [LICENSE](./LICENSE).
- All the code in this repo within `src/pro` is fair-source and licensed under [Functional Source License 1.1 Apache 2.0](https://fsl.software/) - see [LICENSE](./src/pro/LICENSE).
