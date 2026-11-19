-- =====================================================================
--  FINERY APP - Script de creación de base de datos
--  Motor: MySQL 8.0+ (compatible con MariaDB 10.5+)
--  Basado en el diagrama entidad-relación proporcionado
-- =====================================================================

DROP DATABASE IF EXISTS finery_db;
CREATE DATABASE finery_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE finery_db;

-- ---------------------------------------------------------------------
-- 1. USUARIO
--    contrasena y google_id son opcionales: el usuario puede registrarse
--    con correo/contraseña o con Google (la contraseña se guarda HASHEADA).
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre_completo VARCHAR(120)  NOT NULL,
  correo          VARCHAR(150)  NOT NULL,
  contrasena      VARCHAR(255)  NULL,
  google_id       VARCHAR(100)  NULL,
  salario_mensual DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuario_correo (correo),
  UNIQUE KEY uk_usuario_google (google_id),
  CONSTRAINT ck_usuario_salario CHECK (salario_mensual >= 0),
  CONSTRAINT ck_usuario_acceso  CHECK (contrasena IS NOT NULL OR google_id IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. PRESUPUESTO (porcentaje del salario asignado a una categoría)
-- ---------------------------------------------------------------------
CREATE TABLE presupuesto (
  id_presupuesto INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED  NOT NULL,
  nombre         VARCHAR(100)  NOT NULL,
  porcentaje     DECIMAL(5,2)  NOT NULL,
  PRIMARY KEY (id_presupuesto),
  KEY idx_presupuesto_usuario (id_usuario),
  CONSTRAINT fk_presupuesto_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_presupuesto_porcentaje CHECK (porcentaje BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. TIPO_PAGO (catálogo)
-- ---------------------------------------------------------------------
CREATE TABLE tipo_pago (
  id_tipo_pago INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(50)  NOT NULL,
  PRIMARY KEY (id_tipo_pago),
  UNIQUE KEY uk_tipo_pago_nombre (nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. MOVIMIENTO (gastos del usuario)
--    id_presupuesto es opcional: en la app hay movimientos sin presupuesto.
-- ---------------------------------------------------------------------
CREATE TABLE movimiento (
  id_movimiento  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED  NOT NULL,
  id_tipo_pago   INT UNSIGNED  NOT NULL,
  id_presupuesto INT UNSIGNED  NULL,
  concepto       VARCHAR(150)  NOT NULL,
  monto          DECIMAL(12,2) NOT NULL,
  fecha          DATE          NOT NULL,
  PRIMARY KEY (id_movimiento),
  KEY idx_mov_usuario_fecha (id_usuario, fecha),
  KEY idx_mov_tipo_pago (id_tipo_pago),
  KEY idx_mov_presupuesto (id_presupuesto),
  CONSTRAINT fk_mov_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mov_tipo_pago
    FOREIGN KEY (id_tipo_pago) REFERENCES tipo_pago (id_tipo_pago)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_presupuesto
    FOREIGN KEY (id_presupuesto) REFERENCES presupuesto (id_presupuesto)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_mov_monto CHECK (monto > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. META_PERSONAL
-- ---------------------------------------------------------------------
CREATE TABLE meta_personal (
  id_meta        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED  NOT NULL,
  nombre         VARCHAR(100)  NOT NULL,
  monto_objetivo DECIMAL(12,2) NOT NULL,
  monto_ahorrado DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_meta),
  KEY idx_meta_usuario (id_usuario),
  CONSTRAINT fk_meta_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_meta_objetivo CHECK (monto_objetivo > 0),
  CONSTRAINT ck_meta_ahorrado CHECK (monto_ahorrado >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. AHORRO_COMPARTIDO
--    icono = clase de Bootstrap Icons (ej. 'bi-airplane-engines')
--    color = hexadecimal (ej. '#FF5722')
-- ---------------------------------------------------------------------
CREATE TABLE ahorro_compartido (
  id_ahorro      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100)  NOT NULL,
  icono          VARCHAR(50)   NOT NULL DEFAULT 'bi-piggy-bank-fill',
  color          CHAR(7)       NOT NULL DEFAULT '#FF5722',
  monto_objetivo DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_ahorro),
  CONSTRAINT ck_ahorro_objetivo CHECK (monto_objetivo > 0),
  CONSTRAINT ck_ahorro_color    CHECK (color REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. PARTICIPANTE_AHORRO (tabla intermedia usuario <-> ahorro compartido)
--    estado según la app: 'Pendiente' (invitado) | 'Compartiendo' (aceptó)
-- ---------------------------------------------------------------------
CREATE TABLE participante_ahorro (
  id_ahorro  INT UNSIGNED NOT NULL,
  id_usuario INT UNSIGNED NOT NULL,
  estado     ENUM('Pendiente','Compartiendo') NOT NULL DEFAULT 'Pendiente',
  PRIMARY KEY (id_ahorro, id_usuario),
  KEY idx_part_usuario (id_usuario),
  CONSTRAINT fk_part_ahorro
    FOREIGN KEY (id_ahorro) REFERENCES ahorro_compartido (id_ahorro)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_part_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. APORTE_AHORRO (abonos a un ahorro compartido)
-- ---------------------------------------------------------------------
CREATE TABLE aporte_ahorro (
  id_aporte  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_ahorro  INT UNSIGNED  NOT NULL,
  id_usuario INT UNSIGNED  NOT NULL,
  monto      DECIMAL(12,2) NOT NULL,
  fecha      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_aporte),
  KEY idx_aporte_ahorro (id_ahorro),
  KEY idx_aporte_usuario (id_usuario),
  CONSTRAINT fk_aporte_ahorro
    FOREIGN KEY (id_ahorro) REFERENCES ahorro_compartido (id_ahorro)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_aporte_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_aporte_monto CHECK (monto > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. NOTIFICACION
--    id_usuario   = quien recibe
--    id_remitente = quien la origina (NULL si es del sistema)
--    id_ahorro    = ahorro relacionado (NULL si no aplica)
--    tipo en la app: 'invitacion' | 'alerta' | 'aporte'
-- ---------------------------------------------------------------------
CREATE TABLE notificacion (
  id_notificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario      INT UNSIGNED NOT NULL,
  id_remitente    INT UNSIGNED NULL,
  id_ahorro       INT UNSIGNED NULL,
  tipo            ENUM('invitacion','alerta','aporte') NOT NULL,
  titulo          VARCHAR(150) NOT NULL,
  mensaje         TEXT         NOT NULL,
  leida           BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_notificacion),
  KEY idx_notif_usuario_leida (id_usuario, leida, fecha),
  KEY idx_notif_remitente (id_remitente),
  KEY idx_notif_ahorro (id_ahorro),
  CONSTRAINT fk_notif_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notif_remitente
    FOREIGN KEY (id_remitente) REFERENCES usuario (id_usuario)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notif_ahorro
    FOREIGN KEY (id_ahorro) REFERENCES ahorro_compartido (id_ahorro)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
--  VISTAS ÚTILES PARA EL FRONTEND
-- =====================================================================

-- Progreso de cada ahorro compartido (monto_ahorrado y % calculados)
CREATE VIEW v_ahorro_progreso AS
SELECT a.id_ahorro,
       a.nombre,
       a.icono,
       a.color,
       a.monto_objetivo,
       COALESCE(SUM(ap.monto), 0) AS monto_ahorrado,
       ROUND(COALESCE(SUM(ap.monto), 0) / a.monto_objetivo * 100, 1) AS porcentaje
  FROM ahorro_compartido a
  LEFT JOIN aporte_ahorro ap ON ap.id_ahorro = a.id_ahorro
 GROUP BY a.id_ahorro, a.nombre, a.icono, a.color, a.monto_objetivo;

-- Presupuestos con su monto en dinero y lo gastado
CREATE VIEW v_presupuesto_resumen AS
SELECT p.id_presupuesto,
       p.id_usuario,
       p.nombre,
       p.porcentaje,
       ROUND(u.salario_mensual * p.porcentaje / 100, 2) AS monto_asignado,
       COALESCE(SUM(m.monto), 0)                         AS monto_gastado
  FROM presupuesto p
  JOIN usuario u ON u.id_usuario = p.id_usuario
  LEFT JOIN movimiento m ON m.id_presupuesto = p.id_presupuesto
 GROUP BY p.id_presupuesto, p.id_usuario, p.nombre, p.porcentaje, u.salario_mensual;

-- =====================================================================
--  DATOS INICIALES (catálogo que ya usa la app)
-- =====================================================================
INSERT INTO tipo_pago (nombre) VALUES
  ('Efectivo'),
  ('Tarjeta de Débito'),
  ('Tarjeta de Crédito'),
  ('Transferencia');

-- =====================================================================
--  DATOS DE PRUEBA (opcional: bórralos en producción)
--  Las contraseñas deben guardarse con hash (bcrypt/argon2) desde el backend.
-- =====================================================================
INSERT INTO usuario (nombre_completo, correo, contrasena, salario_mensual) VALUES
  ('Usuario Demo',  'demo@finery.com',           '$2b$10$HASH_DE_EJEMPLO_REEMPLAZAR', 2500),
  ('Carlos Méndez', 'carlos.mendez@correo.com',  '$2b$10$HASH_DE_EJEMPLO_REEMPLAZAR', 3000),
  ('Laura Gómez',   'laura.gomez@correo.com',    '$2b$10$HASH_DE_EJEMPLO_REEMPLAZAR', 2800),
  ('Andrés Ruiz',   'andres.ruiz@correo.com',    '$2b$10$HASH_DE_EJEMPLO_REEMPLAZAR', 2600);

INSERT INTO presupuesto (id_usuario, nombre, porcentaje) VALUES
  (1, 'Presupuesto de Alquiler',      40),
  (1, 'Presupuesto de Ahorro',        25),
  (1, 'Presupuesto de Alimentación',  25);

INSERT INTO movimiento (id_usuario, id_tipo_pago, id_presupuesto, concepto, monto, fecha) VALUES
  (1, 3, NULL, 'Suscripción de Internet', 45,  '2026-09-14'),
  (1, 1, 3,    'Compra de Alimentos',     120, '2026-09-13'),
  (1, 2, NULL, 'Gasolina',                40,  '2026-09-12'),
  (1, 4, NULL, 'Servicio de Energía',     55,  '2026-09-09');

INSERT INTO meta_personal (id_usuario, nombre, monto_objetivo, monto_ahorrado) VALUES
  (1, 'Fondo de emergencia', 5000, 1200);

INSERT INTO ahorro_compartido (nombre, icono, color, monto_objetivo) VALUES
  ('Viaje a Cartagena', 'bi-airplane-engines', '#FF5722', 6000);

INSERT INTO participante_ahorro (id_ahorro, id_usuario, estado) VALUES
  (1, 1, 'Compartiendo'),
  (1, 2, 'Compartiendo'),
  (1, 3, 'Compartiendo'),
  (1, 4, 'Pendiente');

INSERT INTO aporte_ahorro (id_ahorro, id_usuario, monto) VALUES
  (1, 1, 300),
  (1, 2, 450),
  (1, 3, 200);

INSERT INTO notificacion (id_usuario, id_remitente, id_ahorro, tipo, titulo, mensaje) VALUES
  (4, 1, 1, 'invitacion', 'Invitación a Ahorro Compartido',
      'Usuario Demo te invitó a participar en "Viaje a Cartagena".'),
  (1, 2, 1, 'aporte', 'Nuevo aporte',
      'Carlos Méndez aportó $450 a "Viaje a Cartagena".');
