#!/usr/bin/env bash
# Uso: bash tests/sql/run_sql_tests.sh   (requiere PostgreSQL 14+ y psql; crea y borra una BD temporal m4_test)
# Orden: stubs de Supabase → M1 REAL → M4 → pruebas → reversa de M4 → reaplicar M4 → reversa de M1.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=m4_test; P="psql -v ON_ERROR_STOP=1 -q -X -d $DB"
dropdb --if-exists $DB; createdb $DB
$P -f tests/sql/00_stubs_supabase.sql
$P -f tests/sql/m1_ref/0001_m1_perfiles_y_roles.sql
$P -f supabase/migrations/20261026000200_m4_simulaciones.sql
$P -f tests/sql/test_m4.sql
$P -f supabase/migrations_down/20261026000200_m4_simulaciones.down.sql
$P -f supabase/migrations/20261026000200_m4_simulaciones.sql
echo "OK"
