using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Migrations;

namespace IDS.Api.Tests;

public sealed class CompanyMigrationTests
{
    [Fact]
    public async Task AreaMigrationPreservesLegacyEvaluationsFormVersionsAndManualIpf()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IdsDbContext>().UseSqlite(connection)
            .ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning)).Options;
        await using var db = new IdsDbContext(options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261019155229_AddInspectionFormVersions");
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "inspection_forms" ("Id", "TenantId", "IsDefault", "CurrentVersion", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ('51000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, 1, '2026-10-01', '2026-10-01');
            INSERT INTO "inspection_form_versions" ("Id", "TenantId", "FormId", "Version", "Name", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ('51000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001',
                '51000000-0000-0000-0000-000000000001', 1, 'Modelo anterior', '2026-10-01', '2026-10-01');
            INSERT INTO "organizations" ("Id", "TenantId", "Name", "Kind", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ('51000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001',
                'Contratada anterior', 2, '2026-10-01', '2026-10-01');
            INSERT INTO "monthly_ipf_records" ("Id", "TenantId", "ContractorOrganizationId", "Year", "Month", "Value", "Source", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ('51000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001',
                '51000000-0000-0000-0000-000000000003', 2026, 10, 0.94, 'Manual', '2026-10-01', '2026-10-01');
            INSERT INTO "evaluations" ("Id", "TenantId", "FormVersionId", "EvaluationDate", "Status", "ObservedPeople", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ('51000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001',
                '51000000-0000-0000-0000-000000000002', '2026-10-01', 'Submitted', 10, '2026-10-01', '2026-10-01');
            """);

        await migrator.MigrateAsync();
        var version = Assert.Single(await db.InspectionFormVersions.IgnoreQueryFilters().ToArrayAsync());
        Assert.Null(version.AreaId);
        Assert.Equal(InspectionArea.DefaultName, version.AreaName);
        Assert.Equal("Modelo anterior", version.Name);
        var evaluation = Assert.Single(await db.Evaluations.IgnoreQueryFilters().ToArrayAsync());
        Assert.Equal(version.Id, evaluation.FormVersionId);
        Assert.Equal(10, evaluation.ObservedPeople);
        Assert.Equal(EvaluationStatus.Submitted, evaluation.Status);
        var ipf = Assert.Single(await db.MonthlyIpfRecords.IgnoreQueryFilters().ToArrayAsync());
        Assert.Equal(0.94m, ipf.Value);
        Assert.Null(ipf.AreaId);
        Assert.Null(ipf.FormId);
        Assert.Empty(await db.InspectionAreas.IgnoreQueryFilters().ToArrayAsync());
    }

    [Fact]
    public async Task ExistingUsersAndSitesAreAssignedToLegacyCompany()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        // The migration snapshot targets PostgreSQL; SQLite is used only for this data-backfill test.
        var options = new DbContextOptionsBuilder<IdsDbContext>().UseSqlite(connection)
            .ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning)).Options;
        await using var db = new IdsDbContext(options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261008142245_AddReportSettings");
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "AspNetUsers" ("Id", "UserName", "EmailConfirmed", "PhoneNumberConfirmed",
                "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount")
            VALUES ('50000000-0000-0000-0000-000000000001', 'legacy@example.com', 1, 0, 0, 1, 0);
            INSERT INTO "sites" ("Id", "Name", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ('50000000-0000-0000-0000-000000000002', 'Legacy site', '2026-10-01', '2026-10-01');
            """);
        await migrator.MigrateAsync();
        var tenant = Assert.Single(await db.Tenants.ToArrayAsync());
        Assert.Equal("Empresa legada de testes", tenant.Name);
        Assert.Equal(tenant.Id, (await db.Users.SingleAsync()).TenantId);
        Assert.Empty(await db.Sites.ToArrayAsync());
        Assert.Equal(tenant.Id, (await db.Sites.IgnoreQueryFilters().SingleAsync()).TenantId);
    }

    [Fact]
    public async Task TenantWritesFailClosedAndCannotChangeCompany()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IdsDbContext>().UseSqlite(connection).Options;
        var companyA = Guid.NewGuid();
        var companyB = Guid.NewGuid();
        await using (var setup = new IdsDbContext(options))
        {
            await setup.Database.EnsureCreatedAsync();
            setup.Tenants.AddRange(new Tenant { Id = companyA, Name = "A" }, new Tenant { Id = companyB, Name = "B" });
            await setup.SaveChangesAsync();
            setup.Sites.Add(new Site { Name = "Unscoped" });
            await Assert.ThrowsAsync<InvalidOperationException>(() => setup.SaveChangesAsync());
        }
        await using var scoped = new IdsDbContext(options, new TestScope(companyA));
        var site = new Site { Name = "A" };
        scoped.Sites.Add(site);
        await scoped.SaveChangesAsync();
        Assert.Equal(companyA, site.TenantId);
        site.TenantId = companyB;
        await Assert.ThrowsAsync<InvalidOperationException>(() => scoped.SaveChangesAsync());
    }

    private sealed record TestScope(Guid? TenantId) : ICurrentUserScope
    {
        public string? UserId => null;
        public bool IsAdministrator => true;
    }
}
