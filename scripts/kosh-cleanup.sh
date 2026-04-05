#!/bin/bash
# Kosh Maintenance & Cleanup Script
# Finalidade: Manter o banco de dados leve e o sistema saudável.
# Uso: Recomendado rodar via Cron semanalmente ou mensalmente.

set -e

RETENTION_DAYS=30
LOG_FILE="/var/log/kosh-maintenance.log"

echo "[$(date)] Iniciando manutenção Kosh..." | tee -a $LOG_FILE

# 1. Limpeza de Logs Antigos no PostgreSQL
echo "[$(date)] Removendo logs com mais de $RETENTION_DAYS dias..." | tee -a $LOG_FILE
sudo -u postgres psql -d logs_db -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '$RETENTION_DAYS days';" | tee -a $LOG_FILE

# 2. Otimização do Banco (VACUUM ANALYZE)
echo "[$(date)] Otimizando tabelas (VACUUM ANALYZE)..." | tee -a $LOG_FILE
sudo -u postgres psql -d logs_db -c "VACUUM ANALYZE logs;" | tee -a $LOG_FILE

# 3. Limpeza de Backups Temporários
echo "[$(date)] Limpando arquivos temporidários em /tmp..." | tee -a $LOG_FILE
find /tmp -name "kosh_db_*.sql.gz" -mtime +1 -delete

# 4. Status de Disco
echo "[$(date)] Status de uso de disco:" | tee -a $LOG_FILE
df -h / | tee -a $LOG_FILE

echo "[$(date)] Manutenção concluída com sucesso." | tee -a $LOG_FILE
