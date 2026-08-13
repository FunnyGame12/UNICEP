'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'conceptos_pago';
    const desc = await queryInterface.describeTable(tableName);

    if (!desc.clasificacion) {
      await queryInterface.addColumn(tableName, 'clasificacion', {
        type: Sequelize.ENUM('base', 'subrama'),
        allowNull: false,
        defaultValue: 'base',
      });
    }

    if (!desc.precio_base_inicial) {
      await queryInterface.addColumn(tableName, 'precio_base_inicial', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }

    if (!desc.id_concepto_padre) {
      await queryInterface.addColumn(tableName, 'id_concepto_padre', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'conceptos_pago',
          key: 'id_concepto_pago',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }

    if (!desc.naturaleza_ajuste) {
      await queryInterface.addColumn(tableName, 'naturaleza_ajuste', {
        type: Sequelize.ENUM('descuento', 'penalizacion'),
        allowNull: true,
      });
    }

    if (!desc.modo_aplicacion) {
      await queryInterface.addColumn(tableName, 'modo_aplicacion', {
        type: Sequelize.ENUM('monto_fijo', 'porcentaje'),
        allowNull: true,
      });
    }

    if (!desc.valor_ajuste) {
      await queryInterface.addColumn(tableName, 'valor_ajuste', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }

    if (!desc.folio_interno) {
      await queryInterface.addColumn(tableName, 'folio_interno', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(
      "UPDATE conceptos_pago SET folio_interno = UPPER(clave) WHERE folio_interno IS NULL OR folio_interno = ''",
    );

    await queryInterface.changeColumn(tableName, 'folio_interno', {
      type: Sequelize.STRING(80),
      allowNull: false,
    });

    const indexes = await queryInterface.showIndex(tableName);
    const hasUniqueFolioIndex = indexes.some((idx) => idx.name === 'conceptos_pago_folio_interno_unique');
    if (!hasUniqueFolioIndex) {
      await queryInterface.addIndex(tableName, ['folio_interno'], {
        unique: true,
        name: 'conceptos_pago_folio_interno_unique',
      });
    }

    const hasParentIndex = indexes.some((idx) => idx.name === 'conceptos_pago_id_concepto_padre_idx');
    if (!hasParentIndex) {
      await queryInterface.addIndex(tableName, ['id_concepto_padre'], {
        name: 'conceptos_pago_id_concepto_padre_idx',
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'conceptos_pago';
    const desc = await queryInterface.describeTable(tableName);

    const indexes = await queryInterface.showIndex(tableName);
    const hasUniqueFolioIndex = indexes.some((idx) => idx.name === 'conceptos_pago_folio_interno_unique');
    if (hasUniqueFolioIndex) {
      await queryInterface.removeIndex(tableName, 'conceptos_pago_folio_interno_unique');
    }

    const hasParentIndex = indexes.some((idx) => idx.name === 'conceptos_pago_id_concepto_padre_idx');
    if (hasParentIndex) {
      await queryInterface.removeIndex(tableName, 'conceptos_pago_id_concepto_padre_idx');
    }

    if (desc.folio_interno) {
      await queryInterface.removeColumn(tableName, 'folio_interno');
    }
    if (desc.valor_ajuste) {
      await queryInterface.removeColumn(tableName, 'valor_ajuste');
    }
    if (desc.modo_aplicacion) {
      await queryInterface.removeColumn(tableName, 'modo_aplicacion');
    }
    if (desc.naturaleza_ajuste) {
      await queryInterface.removeColumn(tableName, 'naturaleza_ajuste');
    }
    if (desc.id_concepto_padre) {
      await queryInterface.removeColumn(tableName, 'id_concepto_padre');
    }
    if (desc.precio_base_inicial) {
      await queryInterface.removeColumn(tableName, 'precio_base_inicial');
    }
    if (desc.clasificacion) {
      await queryInterface.removeColumn(tableName, 'clasificacion');
    }
  },
};
