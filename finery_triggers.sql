-- Triggers de Finery (ejecutar DESPUES de finery_db.sql)
-- Requiere un cliente que soporte DELIMITER (mysql / mariadb en consola).
-- Uso:  mysql -u root -p finery_db < finery_triggers.sql

USE finery_db;

-- =====================================================================
--  TRIGGERS: la suma de porcentajes de presupuestos de un usuario
--  no puede superar el 100 % (regla que ya aplica la interfaz).
-- =====================================================================
DELIMITER $$

CREATE TRIGGER trg_presupuesto_bi
BEFORE INSERT ON presupuesto
FOR EACH ROW
BEGIN
  DECLARE v_suma DECIMAL(7,2);
  SELECT COALESCE(SUM(porcentaje), 0) INTO v_suma
    FROM presupuesto WHERE id_usuario = NEW.id_usuario;
  IF v_suma + NEW.porcentaje > 100 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La suma de porcentajes de presupuestos no puede superar 100%';
  END IF;
END$$

CREATE TRIGGER trg_presupuesto_bu
BEFORE UPDATE ON presupuesto
FOR EACH ROW
BEGIN
  DECLARE v_suma DECIMAL(7,2);
  SELECT COALESCE(SUM(porcentaje), 0) INTO v_suma
    FROM presupuesto
   WHERE id_usuario = NEW.id_usuario
     AND id_presupuesto <> OLD.id_presupuesto;
  IF v_suma + NEW.porcentaje > 100 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La suma de porcentajes de presupuestos no puede superar 100%';
  END IF;
END$$

-- Solo los participantes aceptados pueden aportar a un ahorro compartido
CREATE TRIGGER trg_aporte_bi
BEFORE INSERT ON aporte_ahorro
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM participante_ahorro
     WHERE id_ahorro = NEW.id_ahorro
       AND id_usuario = NEW.id_usuario
       AND estado = 'Compartiendo'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El usuario no es participante activo de este ahorro';
  END IF;
END$$

DELIMITER ;

