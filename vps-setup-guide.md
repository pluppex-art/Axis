# Instalação: Axis CRM Standalone + n8n + Mensageria na VPS Hostinger

> **Atualização 2026-09-24 — leia antes de usar:**
> - **Provedor de WhatsApp real do app = WAHA**, não Evolution API. O backend (`server/whatsappProvider.ts`) integra com o WAHA via `WAHA_API_URL`/`WAHA_API_KEY`; sem essas variáveis cai em um simulador. A seção 4 abaixo (Evolution API) é **legada** e não corresponde ao que o código usa. Passos de instalação do WAHA **não estão neste guia**: consulte a documentação oficial do WAHA e valide a configuração (a-validar).
> - O WAHA precisa chamar o webhook de entrada do app: `POST <api>/api/whatsapp/webhook/:instanceId?secret=<webhook_secret>` (gerado ao criar a instância no CRM). Ver [`docs/WEBHOOKS.md`](docs/WEBHOOKS.md).
> - Variáveis do backend atuais: `SPY_CORS_ORIGIN`, `SPY_API_KEYS`, `WAHA_API_URL`, `WAHA_API_KEY` etc. — ver [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md). Nunca use `CORS_ORIGIN=*` nem chaves fixas de exemplo; gere segredos com `openssl rand -hex 32`.
> - Este guia é anterior ao rebrand (Axis → S.P.Y.) e a parte de infraestrutura (Docker, Nginx Proxy Manager, n8n) **não foi revalidada** em 2026-09-24.

Este documento é o guia definitivo preparado para a fase inicial do Axis CRM. Como a estratégia dos primeiros 6 meses é vender o sistema completo (standalone/white-label) por cliente para gerar fluxo de caixa antes da transição para SaaS, este script contempla a instalação independente da infraestrutura necessária para suportar 1 cliente isoladamente.

## Requisitos
- VPS na Hostinger (KVM 2 ou KVM 4 - Ubuntu 22.04/24.04 Lts)
- Domínio apontando para os IPs da Hostinger:
  - `crm.seudominio.com` (Frontend React)
  - `api.seudominio.com` (Backend Node.js)
  - `n8n.seudominio.com` (n8n Webhook Automations)
  - `wa.seudominio.com` (gateway de WhatsApp — WAHA no app atual; a-validar; o guia original usava `evolution.seudominio.com`)

---

## 1. Preparação Inicial e Docker

Ao acessar a VPS recém-contratada via SSH (`ssh root@ip-da-vps`):

```bash
# Atualize os pacotes
apt update && apt upgrade -y

# Instale ferramentas básicas
apt install -y curl wget git nano ufw software-properties-common tmux

# Instale o Docker e Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install -y docker-compose-plugin

# Crie a estrutura de diretórios para as aplicações
mkdir -p /opt/axis/{n8n,evolution,crm,nginx}
```

---

## 2. Nginx Proxy Manager (Gestão simplificada de SSL e Domínios)

O Nginx Proxy Manager vai pegar as portas `80` e `443` e gerar SSL grátis para todos os subdomínios.

Crie o arquivo `/opt/axis/nginx/docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

Execute:
```bash
cd /opt/axis/nginx
docker compose up -d
```
Acesse `http://ip-da-vps:81` e configure a senha.

---

## 3. n8n - Automações Poderosas

O n8n precisa ser configurado com banco SQLite (ou Postgres) com webhook habilitado.

Em `/opt/axis/n8n/docker-compose.yml`:

```yaml
version: "3.7"
services:
  n8n:
    image: n8nio/n8n
    restart: always
    environment:
      - N8N_HOST=n8n.seudominio.com
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://n8n.seudominio.com/
      - GENERIC_TIMEZONE=America/Sao_Paulo
    ports:
      - "5678:5678"
    volumes:
      - ./n8n_data:/home/node/.n8n
```

Execute:
```bash
cd /opt/axis/n8n
docker compose up -d
```
*Vá no Nginx Proxy Manager e aponte `n8n.seudominio.com` para a porta `5678`.*

---

## 4. Evolution API v2 (WhatsApp Mensageria) — LEGADO

> O app atual integra com **WAHA**, não com a Evolution API. Esta seção é mantida só como referência histórica do exemplo de Docker Compose; não a use como está em produção. Para WAHA, siga a documentação oficial dele (a-validar).

A evolução fará a ponte entre o WhatsApp e o CRM.

Em `/opt/axis/evolution/docker-compose.yml`:

```yaml
version: '3.3'
services:
  evolution-api:
    image: atendai/evolution-api:v2.1.1
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=https://evolution.seudominio.com
      # Restrinja ao domínio do CRM (nunca "*"):
      - CORS_ORIGIN=https://crm.seudominio.com
      - AUTHENTICATION_TYPE=apikey
      # Gere um valor aleatório: openssl rand -hex 32 (não commite nem reutilize)
      - AUTHENTICATION_API_KEY=<GERE-COM-openssl-rand-hex-32>
      - LOG_LEVEL=ERROR
      # Redis Setup (Opcional, mas recomendado para produção em volume)
      # - REDIS_URI=redis://127.0.0.1:6379/1 
    volumes:
      - ./evolution_instances:/evolution/instances
```

Execute:
```bash
cd /opt/axis/evolution
docker compose up -d
```
*No Nginx Proxy Manager aponte `evolution.seudominio.com` para a porta `8080`.*

---

## 5. Subindo o Axis CRM Standalone

Construa sua API do backend local num container do projeto, mapeando o `.env` correto do cliente, apontando para o gateway de WhatsApp (no app atual: `WAHA_API_URL`/`WAHA_API_KEY`; o guia original citava a variável `evolution_api_url`, legada) e para as chaves secretas do GCP e n8n Webhooks. Defina `SPY_CORS_ORIGIN=https://crm.seudominio.com` (só o domínio do CRM) e `SPY_API_KEYS` com chaves aleatórias.

### Configurar Venda Individual (On-premise / Host Privado)
Você foca em vender os módulos com a taxa de Deployment (setup fee).
Existem 2 fatores de crescimento nesta fase:
1. **Implantação (Setup Fee):** R$2k ~ R$5k para a estrutura e configuração.
2. **Manutenção:** R$X/mês (Manutenção da VPS que cobra da Hostinger, custos de LLM e suporte).

Use esse momento para captar bastante grana à vista e refinar o software baseado nos feedbacks muito próximos desses primeiros clientes.
