const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Crear Organización por defecto
  const org = await prisma.organization.upsert({
    where: { nit: '900.123.456' },
    update: {},
    create: {
      name: 'Bright Lawyers S.A.S',
      nit: '900.123.456',
      country: 'Colombia',
      city: 'Bogotá',
      timezone: 'America/Bogota'
    }
  });

  console.log('🏢 Organization created:', org.name);

  // 3. Crear Permisos Básicos
  const permissionsData = [
    { code: 'CASE_READ', description: 'Ver casos' },
    { code: 'CASE_WRITE', description: 'Crear/Editar casos' },
    { code: 'USER_MANAGE', description: 'Gestionar usuarios' },
    { code: 'REPORT_VIEW', description: 'Ver reportes' }
  ];

  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm
    });
  }
  
  console.log('🔑 Permissions seeded');

  // 4. Crear Roles
  const adminRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'admin' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'admin',
      description: 'Administrador del sistema'
    }
  });

  // Asignar permisos a admin
  const allPerms = await prisma.permission.findMany();
  for (const p of allPerms) {
      // Check if exists first to avoid error
      const exists = await prisma.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } }
      });
      if (!exists) {
        await prisma.rolePermission.create({
            data: { roleId: adminRole.id, permissionId: p.id }
        });
      }
  }

  const lawyerRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'abogado' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'abogado',
      description: 'Abogado asociado'
    }
  });
  
  // Asignar permisos a abogado
  const lawyerPerms = allPerms.filter(p => ['CASE_READ', 'CASE_WRITE'].includes(p.code));
  for (const p of lawyerPerms) {
      const exists = await prisma.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId: lawyerRole.id, permissionId: p.id } }
      });
      if (!exists) {
        await prisma.rolePermission.create({
            data: { roleId: lawyerRole.id, permissionId: p.id }
        });
      }
  }

  console.log('🎭 Roles created:', adminRole.name, lawyerRole.name);

  const clientRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'cliente' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'cliente',
      description: 'Cliente del despacho'
    }
  });

  // Asignar permisos a cliente (Solo lectura de casos)
  const clientPerms = allPerms.filter(p => ['CASE_READ'].includes(p.code));
  for (const p of clientPerms) {
      const exists = await prisma.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId: clientRole.id, permissionId: p.id } }
      });
      if (!exists) {
        await prisma.rolePermission.create({
            data: { roleId: clientRole.id, permissionId: p.id }
        });
      }
  }
  console.log('👤 Client Role created');
  


  // 5. Crear Usuario Admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@brightlawyers.com' },
    update: {},
    create: {
      organizationId: org.id,
      fullName: 'Admin BrightLawyers',
      email: 'admin@brightlawyers.com',
      passwordHash: hashedPassword,
      phone: '+57 300 123 4567',
      status: 'active'
    }
  });

  // Asignar Rol Admin al Usuario via tabla intermedia
  const userRoleExists = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } }
  });
  
  if (!userRoleExists) {
    await prisma.userRole.create({
        data: { userId: adminUser.id, roleId: adminRole.id }
    });
  }

  console.log('👤 Admin user created:', adminUser.email);

  // 6. Crear Areas de Práctica (Antes Specialties)
  const practices = [
    { name: 'Derecho Tributario' },
    { name: 'Derecho Penal' },
    { name: 'Derecho de Familia' },
    { name: 'Derecho Laboral' },
    { name: 'Derecho Civil' },
    { name: 'Derecho Administrativo' },
    { name: 'Derecho Comercial' }
  ];

  for (const p of practices) {
    // Check if exists manually as name is not unique in schema (only id)
    // Actually schema says @@map("practice_areas"), no unique constraint on name+orgId but logic suggests we shouldn't dupe
    const existing = await prisma.practiceArea.findFirst({
        where: { organizationId: org.id, name: p.name }
    });
    
    if (!existing) {
        await prisma.practiceArea.create({
            data: {
                organizationId: org.id,
                name: p.name
            }
        });
    }
  }

  console.log('⚖️ Practice Areas seeded');

  // 7. Crear Perfil de Abogado para el Admin
  const penalPractice = await prisma.practiceArea.findFirst({ where: { name: 'Derecho Penal' } });
  
  const existingAdminProfile = await prisma.lawyerProfile.findUnique({ where: { userId: adminUser.id } });
  if (!existingAdminProfile) {
      await prisma.lawyerProfile.create({
        data: {
          userId: adminUser.id,
          organizationId: org.id,
          professionalCardNumber: 'TP-123456',
          professionalCardCountry: 'Colombia',
          yearsExperience: 10,
          bio: 'Abogado especialista en derecho penal con más de 10 años de experiencia.',
          hourlyRate: 250000,
          availabilityStatus: 'available',
          practices: {
            create: {
                practiceAreaId: penalPractice.id,
                level: 'experto'
            }
          }
        }
      });
      console.log('👨‍⚖️ Lawyer Profile created');
  }

  // 8. Crear Cliente de Prueba
  let client = await prisma.client.findFirst({ 
      where: { documentNumber: '1010101010', organizationId: org.id } 
  });

  if (!client) {
      client = await prisma.client.create({
        data: {
          organizationId: org.id,
          clientType: 'PERSON',
          fullNameOrBusinessName: 'Juan Pérez Cliente',
          documentType: 'CC',
          documentNumber: '1010101010',
          email: 'juan.cliente@example.com',
          phone: '+57 300 987 6543',
          address: 'Calle 123 # 45-67, Bogotá',
          status: 'active'
        }
      });
      console.log('🤝 Client created:', client.fullNameOrBusinessName);
  }

  // 8.1 Create User for Client
  const clientPassword = await bcrypt.hash('cliente123', 10);
  const clientUser = await prisma.user.upsert({
    where: { email: 'juan.cliente@example.com' },
    update: {},
    create: {
      organizationId: org.id,
      fullName: 'Juan Pérez Cliente',
      email: 'juan.cliente@example.com',
      passwordHash: clientPassword,
      phone: '+57 300 987 6543',
      status: 'active'
    }
  });

  // Assign Client Role
  const userRoleClientExists = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: clientUser.id, roleId: clientRole.id } }
  });
  
  if (!userRoleClientExists) {
    await prisma.userRole.create({
        data: { userId: clientUser.id, roleId: clientRole.id }
    });
  }

  // Link User to Client Entity
  const clientUserLinkExists = await prisma.clientUser.findUnique({
      where: { clientId_userId: { clientId: client.id, userId: clientUser.id } }
  });

  if (!clientUserLinkExists) {
      await prisma.clientUser.create({
          data: {
              clientId: client.id,
              userId: clientUser.id,
              relationship: 'titular'
          }
      });
  }

  console.log('👤 Client User created:', clientUser.email);


  // --- Create Dedicated Lawyer User ---
  const lawyerPassword = await bcrypt.hash('lawyer123', 10);
  const lawyerUser = await prisma.user.upsert({
    where: { email: 'abogado@brightlawyers.com' },
    update: {},
    create: {
      organizationId: org.id,
      fullName: 'Licenciado Ejemplo',
      email: 'abogado@brightlawyers.com',
      passwordHash: lawyerPassword,
      phone: '+57 300 555 5555',
      status: 'active'
    }
  });

  // Assign Lawyer Role
  const userRoleLawyerExists = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: lawyerUser.id, roleId: lawyerRole.id } }
  });
  
  if (!userRoleLawyerExists) {
    await prisma.userRole.create({
        data: { userId: lawyerUser.id, roleId: lawyerRole.id }
    });
  }

  console.log('👤 Lawyer user created:', lawyerUser.email);

  // Create Lawyer Profile
  const civilPractice = await prisma.practiceArea.findFirst({ where: { name: 'Derecho Civil' } });
  
  // Check if profile exists to avoid error on re-seed (upsert is better but create throws if unique constraint violated)
  const existingProfile = await prisma.lawyerProfile.findUnique({ where: { userId: lawyerUser.id } });
  if (!existingProfile) {
      await prisma.lawyerProfile.create({
        data: {
          userId: lawyerUser.id,
          organizationId: org.id,
          professionalCardNumber: 'TP-999999',
          professionalCardCountry: 'Colombia',
          yearsExperience: 5,
          bio: 'Abogado civilista enfocado en contratos y litigios.',
          hourlyRate: 180000,
          availabilityStatus: 'available',
          practices: {
            create: {
                practiceAreaId: civilPractice.id,
                level: 'senior'
            }
          }
        }
      });
      console.log('👨‍⚖️ Dedicated Lawyer Profile created');
  }

  // Create Opportunity Case (Unassigned) for this lawyer
  const existingOppCase = await prisma.case.findFirst({ where: { caseNumberInternal: `CASE-${new Date().getFullYear()}-002` } });
  if (!existingOppCase) {
      await prisma.case.create({
        data: {
          organizationId: org.id,
          clientId: client.id, // Reusing existing client
          practiceAreaId: civilPractice.id,
          caseNumberInternal: `CASE-${new Date().getFullYear()}-002`,
          title: 'Demanda Civil - Incumplimiento Contrato',
          description: 'Demanda por incumplimiento de contrato de arrendamiento comercial.',
          caseStatus: 'intake', // Important: Intake status for opportunities
          confidentialityLevel: 'normal',
          createdBy: adminUser.id
        }
      });
      console.log('🌟 Opportunity Case created for Civil Law');
  }

  // 9. Crear Caso de Prueba
  let newCase = await prisma.case.findFirst({ where: { caseNumberInternal: `CASE-${new Date().getFullYear()}-001` } });
  
  if (!newCase) {
      newCase = await prisma.case.create({
        data: {
          organizationId: org.id,
          clientId: client.id,
          practiceAreaId: penalPractice.id,
          caseNumberInternal: `CASE-${new Date().getFullYear()}-001`,
          title: 'Defensa Penal - Caso Hurto',
          description: 'Defensa técnica en proceso penal por presunto delito de hurto.',
          caseStatus: 'active',
          confidentialityLevel: 'normal',
          createdBy: adminUser.id
        }
      });
      console.log('📂 Case created:', newCase.caseNumberInternal);

      // 10. Asignar Abogado al Caso
      await prisma.caseAssignment.create({
        data: {
          caseId: newCase.id,
          assignedUserId: adminUser.id,
          assignmentRole: 'LEAD_LAWYER',
          isPrimary: true
        }
      });
      console.log('📎 Lawyer assigned to case');

      // 11. Crear Tareas para el Caso
      await prisma.task.createMany({
        data: [
          {
            organizationId: org.id,
            caseId: newCase.id,
            title: 'Revisar expediente',
            description: 'Leer y analizar los documentos iniciales de la fiscalía.',
            taskType: 'review',
            priority: 'high',
            status: 'todo',
            assignedToUserId: adminUser.id,
            dueAt: new Date(new Date().setDate(new Date().getDate() + 2))
          },
          {
            organizationId: org.id,
            caseId: newCase.id,
            title: 'Entrevista con cliente',
            description: 'Reunión inicial para conocer la versión de los hechos.',
            taskType: 'meeting',
            priority: 'med',
            status: 'todo',
            assignedToUserId: adminUser.id,
            dueAt: new Date(new Date().setDate(new Date().getDate() + 5))
          }
        ]
      });
      console.log('✅ Tasks created');
  } else {
      console.log('📂 Case already exists:', newCase.caseNumberInternal);
  }

  // 12. Crear Etapas Procesales
  const stages = [
    { name: 'Indagación', description: 'Etapa inicial de investigación' },
    { name: 'Imputación', description: 'Formulación de cargos' },
    { name: 'Juicio', description: 'Etapa de juicio oral' }
  ];

  let createdStages = [];
  for (const s of stages) {
    let stage = await prisma.proceduralStage.findFirst({
        where: { organizationId: org.id, name: s.name }
    });
    
    if (!stage) {
        stage = await prisma.proceduralStage.create({
          data: {
            organizationId: org.id,
            name: s.name,
            description: s.description
          }
        });
    }
    createdStages.push(stage);
  }
  console.log('stairs Procedural Stages created/found');

  // 13. Agregar Evento a la Línea de Tiempo
  await prisma.caseTimelineEvent.create({
    data: {
      caseId: newCase.id,
      stageId: createdStages[0].id,
      eventType: 'ACTUACION',
      eventDate: new Date(),
      summary: 'Apertura del caso',
      details: 'Se recibe poder y se da apertura formal al caso en el sistema.',
      createdBy: adminUser.id
    }
  });
  console.log('📅 Timeline event added');

  // 14. Crear Documento Simulado
  const doc = await prisma.document.create({
    data: {
      organizationId: org.id,
      ownerUserId: adminUser.id,
      storageProvider: 'local',
      storageKey: '/uploads/poder_juan_perez.pdf',
      fileName: 'Poder_Juan_Perez.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 500, // 500KB
      isConfidential: true
    }
  });

  // Vincular Documento al Caso
  await prisma.documentLink.create({
    data: {
      organizationId: org.id,
      documentId: doc.id,
      entityType: 'CASE',
      entityId: newCase.id,
      docCategory: 'PODER',
      notes: 'Poder especial firmado para la defensa.'
    }
  });
  console.log('📄 Document created and linked');

  // 15. Crear Nota del Caso
  await prisma.caseNote.create({
    data: {
      caseId: newCase.id,
      authorUserId: adminUser.id,
      visibility: 'internal',
      note: 'El cliente parece tener una coartada sólida. Verificar testigos.'
    }
  });
  console.log('📝 Case note added');

}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('✨ Seed finished.');
  });
