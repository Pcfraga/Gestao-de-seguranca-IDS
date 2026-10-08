using IDS.Domain.Entities;
using IDS.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace IDS.Infrastructure.Persistence;

public sealed class IdsDbContext(DbContextOptions<IdsDbContext> options)
    : IdentityDbContext<IdsUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<Site> Sites => Set<Site>();

    public DbSet<Evaluation> Evaluations => Set<Evaluation>();

    public DbSet<ObservationCategory> ObservationCategories => Set<ObservationCategory>();

    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();

    public DbSet<SeverityLevel> SeverityLevels => Set<SeverityLevel>();

    public DbSet<EvaluationObservation> EvaluationObservations => Set<EvaluationObservation>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public DbSet<MonthlyIpfRecord> MonthlyIpfRecords => Set<MonthlyIpfRecord>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyAuditTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        ApplyAuditTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Organization>(entity =>
        {
            entity.ToTable("organizations");
            entity.Property(value => value.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(value => new { value.Kind, value.Name }).IsUnique();
            entity.ConfigureAuditFields();
        });

        builder.Entity<Site>(entity =>
        {
            entity.ToTable("sites");
            entity.Property(value => value.Name).HasMaxLength(200).IsRequired();
            entity.Property(value => value.ProjectOrIsland).HasMaxLength(200);
            entity.HasIndex(value => new { value.Name, value.ProjectOrIsland }).IsUnique();
            entity.ConfigureAuditFields();
        });

        builder.Entity<Evaluation>(entity =>
        {
            entity.ToTable("evaluations");
            entity.Property(value => value.ObservedPeople).HasPrecision(12, 3);
            entity.Property(value => value.LeadAuditorName).HasMaxLength(200);
            entity.Property(value => value.AuditorName).HasMaxLength(200);
            entity.Property(value => value.CompanionName).HasMaxLength(200);
            entity.Property(value => value.Status).HasConversion<string>().HasMaxLength(20);
            entity.HasIndex(value => value.EvaluationDate);
            entity.HasIndex(value => new { value.SiteId, value.EvaluationDate });
            entity.HasOne(value => value.Site).WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(value => value.ClientOrganization).WithMany().HasForeignKey(value => value.ClientOrganizationId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(value => value.ContractorOrganization).WithMany().HasForeignKey(value => value.ContractorOrganizationId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(value => value.SubcontractorOrganization).WithMany().HasForeignKey(value => value.SubcontractorOrganizationId).OnDelete(DeleteBehavior.Restrict);
            entity.ConfigureAuditFields();
        });

        builder.Entity<ObservationCategory>(entity =>
        {
            entity.ToTable("observation_categories");
            entity.Property(value => value.Code).HasMaxLength(50).IsRequired();
            entity.Property(value => value.Name).HasMaxLength(150).IsRequired();
            entity.HasIndex(value => value.Code).IsUnique();
            entity.ConfigureAuditFields();
        });

        builder.Entity<ChecklistItem>(entity =>
        {
            entity.ToTable("checklist_items");
            entity.Property(value => value.Code).HasMaxLength(80).IsRequired();
            entity.Property(value => value.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(value => value.Code).IsUnique();
            entity.HasIndex(value => new { value.CategoryId, value.SortOrder }).IsUnique();
            entity.HasOne(value => value.Category).WithMany(value => value.Items).HasForeignKey(value => value.CategoryId).OnDelete(DeleteBehavior.Restrict);
            entity.ConfigureAuditFields();
        });

        builder.Entity<SeverityLevel>(entity =>
        {
            entity.ToTable("severity_levels", table =>
                table.HasCheckConstraint("ck_severity_levels_weight_positive", "\"Weight\" > 0"));
            entity.Property(value => value.Name).HasMaxLength(80).IsRequired();
            entity.Property(value => value.Weight).HasPrecision(5, 2);
            entity.HasIndex(value => value.Weight).IsUnique();
            entity.ConfigureAuditFields();
        });

        builder.Entity<EvaluationObservation>(entity =>
        {
            entity.ToTable("evaluation_observations");
            entity.Property(value => value.Quantity).HasPrecision(12, 3);
            entity.Property(value => value.Comment).HasMaxLength(2000);
            entity.HasIndex(value => new { value.EvaluationId, value.ChecklistItemId }).IsUnique();
            entity.HasOne(value => value.Evaluation).WithMany(value => value.Observations).HasForeignKey(value => value.EvaluationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(value => value.ChecklistItem).WithMany().HasForeignKey(value => value.ChecklistItemId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(value => value.SeverityLevel).WithMany().HasForeignKey(value => value.SeverityLevelId).OnDelete(DeleteBehavior.Restrict);
            entity.ConfigureAuditFields();
        });

        builder.Entity<AuditEvent>(entity =>
        {
            entity.ToTable("audit_events");
            entity.Property(value => value.Action).HasMaxLength(80).IsRequired();
            entity.Property(value => value.EntityType).HasMaxLength(120).IsRequired();
            entity.Property(value => value.EntityId).HasMaxLength(80).IsRequired();
            entity.Property(value => value.ActorUserId).HasMaxLength(450);
            entity.Property(value => value.CorrelationId).HasMaxLength(120);
            entity.HasIndex(value => new { value.EntityType, value.EntityId, value.CreatedAtUtc });
            entity.HasIndex(value => new { value.ActorUserId, value.CreatedAtUtc });
            entity.ConfigureAuditFields();
        });

        builder.Entity<MonthlyIpfRecord>(entity =>
        {
            entity.ToTable("monthly_ipf_records", table =>
                table.HasCheckConstraint("ck_monthly_ipf_records_month", "\"Month\" BETWEEN 1 AND 12"));
            entity.Property(value => value.Value).HasPrecision(12, 4);
            entity.Property(value => value.Source).HasMaxLength(40).IsRequired();
            entity.HasIndex(value => new { value.ContractorOrganizationId, value.Year, value.Month }).IsUnique();
            entity.HasOne(value => value.ContractorOrganization).WithMany().HasForeignKey(value => value.ContractorOrganizationId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(value => value.Site).WithMany().HasForeignKey(value => value.SiteId).OnDelete(DeleteBehavior.Restrict);
            entity.ConfigureAuditFields();
        });

        SeedCatalog(builder);
        SeedRoles(builder);
    }

    private static void SeedCatalog(ModelBuilder builder)
    {
        var createdAt = DateTimeOffset.UnixEpoch;
        var categories = new[]
        {
            new ObservationCategory { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Code = "epi", Name = "Uso de EPI's", SortOrder = 1, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new ObservationCategory { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Code = "people_position", Name = "Posição das pessoas", SortOrder = 2, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new ObservationCategory { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Code = "observed_action", Name = "Ação quando observado", SortOrder = 3, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new ObservationCategory { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Code = "procedures", Name = "Procedimentos", SortOrder = 4, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new ObservationCategory { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Code = "tools_equipment", Name = "Ferramentas e equipamentos", SortOrder = 5, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new ObservationCategory { Id = Guid.Parse("10000000-0000-0000-0000-000000000006"), Code = "organization", Name = "Padrões de organização", SortOrder = 6, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt }
        };

        builder.Entity<ObservationCategory>().HasData(categories);

        var itemRows = new (string Code, string Name, int Category, int Order)[]
        {
            ("epi_helmet", "Capacete/Jugular", 1, 1),
            ("epi_respirator", "Máscara Respiratória", 1, 2),
            ("epi_glasses", "Óculos", 1, 3),
            ("epi_face_shield", "Protetor Facial", 1, 4),
            ("epi_hearing_protection", "Protetor Auricular", 1, 5),
            ("epi_gloves", "Luvas", 1, 6),
            ("epi_apron", "Avental/jaleco", 1, 7),
            ("epi_safety_footwear", "Calçado de Segurança", 1, 8),
            ("epi_harness", "Cinto de Segurança", 1, 9),
            ("position_struck_by", "Bater contra/Ser atingido por", 2, 1),
            ("position_caught_in", "Ficar preso", 2, 2),
            ("position_fall", "Risco de queda", 2, 3),
            ("position_burn", "Risco de queimadura", 2, 4),
            ("position_electric_shock", "Risco de choque elétrico", 2, 5),
            ("position_contaminant", "Inalar/Absorver contaminantes", 2, 6),
            ("position_overlapping_work", "Trabalho Sobreposto", 2, 7),
            ("position_ingestion", "Ingerir contaminantes", 2, 8),
            ("position_posture", "Postura inadequada", 2, 9),
            ("position_effort", "Esforço inadequado", 2, 10),
            ("action_position_change", "Mudança de posição", 3, 1),
            ("action_stop", "Paraliza a atividade", 3, 2),
            ("action_adjust_ppe", "Ajusta o EPI", 3, 3),
            ("action_adjust_service", "Adequa o serviço", 3, 4),
            ("procedure_inadequate", "Inadequados", 4, 1),
            ("procedure_missing", "Não existem procedimentos escritos", 4, 2),
            ("procedure_not_followed", "Adequados e não são seguidos", 4, 3),
            ("tool_unsuitable", "Impróprio para o serviço", 5, 1),
            ("tool_misused", "Usados incorretamente", 5, 2),
            ("tool_unsafe", "Em condição inseguras", 5, 3),
            ("organization_dirty", "Local sujo/desorganizado", 6, 1),
            ("organization_storage", "Armazenamento inadequado", 6, 2),
            ("organization_contamination", "Contaminação Ambiental", 6, 3)
        };

        var items = itemRows.Select(row => new ChecklistItem
        {
            Id = Guid.Parse($"20000000-0000-0000-0000-{Array.IndexOf(itemRows, row) + 1:000000000000}"),
            CategoryId = categories[row.Category - 1].Id,
            Code = row.Code,
            Name = row.Name,
            SortOrder = row.Order,
            IsActive = true,
            CreatedAtUtc = createdAt,
            UpdatedAtUtc = createdAt
        }).ToArray();

        builder.Entity<ChecklistItem>().HasData(items);

        builder.Entity<SeverityLevel>().HasData(
            new SeverityLevel { Id = Guid.Parse("30000000-0000-0000-0000-000000000001"), Name = "Baixo", Weight = 0.3m, SortOrder = 1, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new SeverityLevel { Id = Guid.Parse("30000000-0000-0000-0000-000000000002"), Name = "Médio", Weight = 1m, SortOrder = 2, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt },
            new SeverityLevel { Id = Guid.Parse("30000000-0000-0000-0000-000000000003"), Name = "Alto", Weight = 3m, SortOrder = 3, CreatedAtUtc = createdAt, UpdatedAtUtc = createdAt });
    }

    private static void SeedRoles(ModelBuilder builder)
    {
        var roles = new[] { "ADMINISTRADOR", "GESTOR", "AVALIADOR", "CONSULTA" };
        for (var index = 0; index < roles.Length; index++)
        {
            var roleName = roles[index];
            builder.Entity<IdentityRole<Guid>>().HasData(new IdentityRole<Guid>
            {
                Id = Guid.Parse($"00000000-0000-0000-0000-{index + 1:000000000000}"),
                Name = roleName,
                NormalizedName = roleName
            });
        }
    }

    private void ApplyAuditTimestamps()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (EntityEntry<AuditableEntity> entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
                entry.Entity.UpdatedAtUtc = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(entity => entity.CreatedAtUtc).IsModified = false;
                entry.Entity.UpdatedAtUtc = now;
            }
        }
    }
}

internal static class EntityTypeBuilderExtensions
{
    public static Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> ConfigureAuditFields<TEntity>(
        this Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> entity)
        where TEntity : AuditableEntity
    {
        entity.Property(value => value.CreatedAtUtc).IsRequired();
        entity.Property(value => value.UpdatedAtUtc).IsRequired();
        entity.Property(value => value.CreatedByUserId).HasMaxLength(450);
        entity.Property(value => value.UpdatedByUserId).HasMaxLength(450);
        return entity;
    }
}