using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using IDS.Api.Controllers;
using IDS.Application.Reports;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Api.Tests;

public sealed class IpfCompositionTests
{
    private const string Password = "Composition-Tests-Password-123!";
    private const string Route = "/api/reports/ipf-composition/2026/10";
    private static readonly Guid Medium = Guid.Parse("30000000-0000-0000-0000-000000000002");
    private static readonly Guid Item = Guid.Parse("20000000-0000-0000-0000-000000000001");

    [Fact]
    public async Task FourAreaSnapshotsRetainMissingAndZeroWeightsAndAnnualMeanAndTenantGuards()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "four");
        using var foreign = await Administrator(factory, "four-foreign");
        var contractor = await Organization(admin);
        var area = await Area(admin, "Área com média");
        var missing = await Area(admin, "Área sem média");
        var zeroWeight = await Area(admin, "Área sem peso");
        var tenant = await Tenant(factory, "four");
        var foreignTenant = await Tenant(factory, "four-foreign");
        using var scope = factory.Services.CreateScope();
        var options = scope.ServiceProvider.GetRequiredService<DbContextOptions<IdsDbContext>>();
        await using (var db = new IdsDbContext(options, new TestScope(tenant)))
        {
            var version = new InspectionFormVersion
            {
                Form = new InspectionForm(), Version = 1, AreaId = area, Name = "Área com média"
            };
            var october = Evaluation(contractor, null, 10m);
            var november = Evaluation(contractor, null, 0m);
            november.EvaluationDate = new(2026, 11, 1);
            db.Evaluations.AddRange(october, november, Evaluation(contractor, version, 4m));
            await db.SaveChangesAsync();
        }
        var request = Request(contractor, (Guid.Empty, 70m), (area, 20m), (missing, 10m), (zeroWeight, 0m));
        var saved = await Save(admin, request);
        Assert.Equal(0.1333m, saved.Value);
        var reloaded = Assert.Single((await History(admin, contractor)).Months);
        Assert.Equal(4, reloaded.Areas.Count);
        Assert.Equal("included", reloaded.Areas.First().Status);
        Assert.Equal(0m, reloaded.Areas.First().Average);
        Assert.Equal(0m, reloaded.Areas.First().Contribution);
        Assert.Equal("no-average", reloaded.Areas.ElementAt(2).Status);
        Assert.Equal("zero-weight", reloaded.Areas.Last().Status);
        Assert.Equal(0m, reloaded.Areas.Last().EffectiveWeight);
        Assert.Null(reloaded.Areas.Last().Contribution);
        var novemberResponse = await admin.PutAsJsonAsync("/api/reports/ipf-composition/2026/11",
            Request(contractor, (Guid.Empty, 100m)));
        Assert.Equal(HttpStatusCode.OK, novemberResponse.StatusCode);
        Assert.Equal(0.56665m, (await History(admin, contractor)).AnnualAverage);

        await using (var db = new IdsDbContext(options, new TestScope(foreignTenant)))
        {
            Assert.Empty(await db.IpfCompositions.ToArrayAsync());
            Assert.Empty(await db.IpfCompositionAreas.ToArrayAsync());
            var otherTenantRow = await db.IpfCompositionAreas.IgnoreQueryFilters().FirstAsync();
            otherTenantRow.AreaName = "Tentativa de alteração";
            await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        }
        Assert.Equal("Área com média", (await History(admin, contractor)).Months.First().Areas.ElementAt(1).AreaName);
    }

    [Fact]
    public async Task CombinesAllFormsAndLegacyDraftsPersistsSnapshotsAndKeepsOldHistories()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "snapshot");
        var contractor = await Organization(admin);
        var area = await Area(admin, "Ambiente");
        var emptyArea = await Area(admin, "Qualidade");
        using var scope = factory.Services.CreateScope();
        var options = scope.ServiceProvider.GetRequiredService<DbContextOptions<IdsDbContext>>();
        var tenant = await Tenant(factory, "snapshot");
        await using (var db = new IdsDbContext(options, new TestScope(tenant)))
        {
            var form = new InspectionForm();
            var otherForm = new InspectionForm();
            var sstForm = new InspectionForm();
            var version = new InspectionFormVersion { Form = form, Version = 1, AreaId = area, Name = "Primeiro" };
            var otherVersion = new InspectionFormVersion { Form = otherForm, Version = 1, AreaId = area, Name = "Segundo" };
            var sstVersion = new InspectionFormVersion { Form = sstForm, Version = 1, Name = "SST customizado" };
            db.Evaluations.AddRange(
                Evaluation(contractor, null, 2m), // legacy SST draft: 0.8
                Evaluation(contractor, sstVersion, 0m), // another SST form: 1
                Evaluation(contractor, version, 4m), // 0.6
                Evaluation(contractor, otherVersion, 6m), // 0.4
                Evaluation(contractor, version, 0m, 0m)); // unscored draft
            await db.SaveChangesAsync();
        }

        var request = Request(contractor, (Guid.Empty, 70m), (area, 30m));
        var preview = await Preview(admin, request);
        Assert.Null(preview.Id);
        Assert.Null(preview.UpdatedAtUtc);
        Assert.Equal(0.78m, preview.Value);
        Assert.Equal(0.9m, preview.Areas.First().Average);
        Assert.Equal(0.5m, preview.Areas.Last().Average);
        Assert.Equal(3, preview.Areas.Last().EvaluationCount);
        Assert.Equal(2, preview.Areas.Last().ScoredEvaluationCount);
        var noAverage = await Preview(admin, Request(contractor, (Guid.Empty, 70m), (emptyArea, 30m)));
        Assert.Equal(0.9m, noAverage.Value);
        Assert.Equal(100m, noAverage.Areas.First().EffectiveWeight);
        Assert.Equal("no-average", noAverage.Areas.Last().Status);

        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new UpsertMonthlyIpfRequest(contractor, null, 7.2m))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new UpsertMonthlyIpfRequest(contractor, null, 8.1m, area,
                await FirstFormId(options, tenant, area)))).StatusCode);
        var saved = await Save(admin, request);
        Assert.NotNull(saved.Id);
        Assert.NotNull(saved.UpdatedAtUtc);
        Assert.Equal(preview.Value, saved.Value);
        await using (var db = new IdsDbContext(options, new TestScope(tenant)))
        {
            foreach (var evaluation in await db.Evaluations.Where(value => value.ObservedPeople > 0).ToArrayAsync())
                evaluation.ObservedPeople = 20m;
            (await db.InspectionAreas.SingleAsync(value => value.Id == area)).Name = "Área renomeada";
            (await db.Organizations.SingleAsync(value => value.Id == contractor)).Name = "Contratada renomeada";
            await db.SaveChangesAsync();
        }
        var history = await History(admin, contractor);
        var reloaded = Assert.Single(history.Months);
        Assert.Equal(saved.Id, reloaded.Id);
        Assert.Equal(saved.Value, reloaded.Value);
        Assert.True((saved.UpdatedAtUtc!.Value - reloaded.UpdatedAtUtc!.Value).Duration() < TimeSpan.FromMilliseconds(1));
        Assert.Equal("Ambiente", reloaded.Areas.Last().AreaName);
        Assert.Equal("Contratada", reloaded.Contractor);
        Assert.Equal(0.78m, history.AnnualAverage);
        Assert.Equal(0.89m, (await Preview(admin, request)).Value);
        var recalculated = await Save(admin, request);
        Assert.Equal(saved.Id, recalculated.Id);
        Assert.Equal(0.89m, recalculated.Value);
        Assert.Equal("Área renomeada", recalculated.Areas.Last().AreaName);
        Assert.Equal("Contratada renomeada", recalculated.Contractor);
        Assert.Equal(0.89m, Assert.Single((await History(admin, contractor)).Months).Value);
        await using (var db = new IdsDbContext(options, new TestScope(tenant)))
        {
            Assert.Single(await db.IpfCompositions.ToArrayAsync());
            Assert.Equal(2, await db.IpfCompositionAreas.CountAsync());
            Assert.Equal(new[] { 7.2m, 8.1m }, (await db.MonthlyIpfRecords.ToArrayAsync()).Select(record => record.Value).Order().ToArray());
        }
    }

    [Fact]
    public async Task ValidatesInputsPeriodsMissingScoresAndTenantOwnership()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "validation");
        using var other = await Administrator(factory, "foreign");
        var contractor = await Organization(admin);
        var foreignContractor = await Organization(other);
        var foreignArea = await Area(other, "Estrangeira");
        var client = await Organization(admin, "Cliente", "Client");
        IpfCompositionRequest?[] invalid = [
            null, new(null, []), new(contractor, null), new(contractor, []),
            new(contractor, [null]), new(contractor, [new(null, 100m)]), new(contractor, [new(Guid.Empty, null)]),
            Request(contractor, (Guid.Empty, 99m)),
            Request(contractor, (Guid.Empty, 101m), (Guid.NewGuid(), -1m)),
            Request(contractor, (Guid.Empty, 50m), (Guid.Empty, 50m)),
            Request(contractor, (foreignArea, 100m)), Request(contractor, (Guid.NewGuid(), 100m)),
            Request(foreignContractor, (Guid.Empty, 100m)), Request(client, (Guid.Empty, 100m)),
            new(contractor, Enumerable.Range(0, 5).Select(_ => (IpfCompositionAreaRequest?)new(Guid.NewGuid(), 20m)).ToArray())
        ];
        foreach (var request in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync($"{Route}/preview", request)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync(Route, request)).StatusCode);
        }
        var valid = Request(contractor, (Guid.Empty, 100m));
        foreach (var period in new[] { "1999/1", "2201/1", "2026/0", "2026/13" })
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync(
                $"/api/reports/ipf-composition/{period}/preview", valid)).StatusCode);
        foreach (var year in new[] { 2000, 2200 })
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync(
                $"/api/reports/ipf-composition/{year}/12/preview", valid)).StatusCode);
        Assert.Null((await Preview(admin, valid)).Value);
        var unsavable = await admin.PutAsJsonAsync(Route, valid);
        Assert.Equal(HttpStatusCode.BadRequest, unsavable.StatusCode);
        Assert.Contains("nenhuma área", await unsavable.Content.ReadAsStringAsync());
        Assert.Empty((await History(admin, contractor)).Months);
        Assert.Equal(HttpStatusCode.BadRequest, (await other.GetAsync(
            $"/api/reports/ipf-composition/2026?contractorId={contractor}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync(
            $"/api/reports/ipf-composition/1999?contractorId={contractor}")).StatusCode);
    }

    [Fact]
    public async Task AuthenticatedPreviewUsesOwnEvaluationsWhileOnlyManagersAndAdministratorsCanSave()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "roles");
        using var other = await Administrator(factory, "roles-other");
        using var evaluator = await User(factory, admin, "AVALIADOR");
        using var manager = await User(factory, admin, "GESTOR");
        using var reader = await User(factory, admin, "CONSULTA");
        using var anonymous = factory.CreateClient();
        var contractor = await Organization(admin);
        var request = Request(contractor, (Guid.Empty, 100m));
        using var scope = factory.Services.CreateScope();
        var options = scope.ServiceProvider.GetRequiredService<DbContextOptions<IdsDbContext>>();
        var tenant = await Tenant(factory, "roles");
        var evaluatorId = await UserId(evaluator);
        var managerId = await UserId(manager);
        await using (var db = new IdsDbContext(options, new TestScope(tenant)))
        {
            var adminEvaluation = Evaluation(contractor, null, 0m);
            var ownEvaluation = Evaluation(contractor, null, 10m);
            ownEvaluation.CreatedByUserId = evaluatorId;
            var managerEvaluation = Evaluation(contractor, null, 30m);
            managerEvaluation.CreatedByUserId = managerId;
            db.Evaluations.AddRange(adminEvaluation, ownEvaluation, managerEvaluation);
            await db.SaveChangesAsync();
        }
        Assert.Equal(0m, (await Preview(evaluator, request)).Value);
        Assert.Equal(1, (await Preview(evaluator, request)).Areas.Single().EvaluationCount);
        Assert.Null((await Preview(reader, request)).Value);
        Assert.Equal(-2m, (await Preview(manager, request)).Value);
        Assert.Equal(-0.3333m, (await Preview(admin, request)).Value);
        Assert.Equal(HttpStatusCode.Forbidden, (await evaluator.PutAsJsonAsync(Route, request)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PutAsJsonAsync(Route, request)).StatusCode);
        Assert.Equal(-2m, (await Save(manager, request)).Value);
        Assert.Single((await History(reader, contractor)).Months);
        Assert.Equal(-0.3333m, (await Save(admin, request)).Value);
        Assert.Equal(HttpStatusCode.BadRequest, (await other.PutAsJsonAsync(Route, request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync($"{Route}/preview", request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(
            $"/api/reports/ipf-composition/2026?contractorId={contractor}")).StatusCode);
    }

    private static Evaluation Evaluation(Guid contractor, InspectionFormVersion? version, decimal quantity, decimal people = 10m) => new()
    {
        ContractorOrganizationId = contractor, FormVersion = version, EvaluationDate = new(2026, 10, 19),
        ObservedPeople = people,
        Observations = [new() { ChecklistItemId = Item, SeverityLevelId = Medium, Quantity = quantity }]
    };

    private static IpfCompositionRequest Request(Guid contractor, params (Guid Area, decimal Weight)[] areas) =>
        new(contractor, areas.Select(area => (IpfCompositionAreaRequest?)new(area.Area, area.Weight)).ToArray());

    private static async Task<CompositionDto> Preview(HttpClient client, IpfCompositionRequest request)
    {
        var response = await client.PostAsJsonAsync($"{Route}/preview", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<CompositionDto>())!;
    }

    private static async Task<CompositionDto> Save(HttpClient client, IpfCompositionRequest request)
    {
        var response = await client.PutAsJsonAsync(Route, request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<CompositionDto>())!;
    }

    private static async Task<IpfCompositionYearDto> History(HttpClient client, Guid contractor) =>
        (await client.GetFromJsonAsync<IpfCompositionYearDto>(
            $"/api/reports/ipf-composition/2026?contractorId={contractor}"))!;

    private static async Task<Guid> Organization(HttpClient client, string name = "Contratada", string kind = "Contractor")
    {
        var response = await client.PostAsJsonAsync("/api/catalog/organizations", new { name, kind });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> Area(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/inspection-areas", new { name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task<HttpClient> Administrator(CompanyApiFactory factory, string suffix)
    {
        var client = factory.CreateClient();
        var email = $"{suffix}@example.com";
        var response = await client.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = suffix, displayName = "Admin", email, password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await Login(client, email);
        return client;
    }

    private static async Task<HttpClient> User(CompanyApiFactory factory, HttpClient admin, string role)
    {
        var email = $"{role}@example.com";
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/auth/users",
            new { email, displayName = role, password = Password, role })).StatusCode);
        var client = factory.CreateClient();
        await Login(client, email);
        return client;
    }

    private static async Task Login(HttpClient client, string email)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            (await login.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
    }

    private static async Task<Guid> Tenant(CompanyApiFactory factory, string name)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IdsDbContext>().Tenants
            .Where(tenant => tenant.Name == name).Select(tenant => tenant.Id).SingleAsync();
    }

    private static async Task<string> UserId(HttpClient client) =>
        (await client.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("id").GetGuid().ToString();

    private static async Task<Guid> FirstFormId(DbContextOptions<IdsDbContext> options, Guid tenant, Guid area)
    {
        await using var db = new IdsDbContext(options, new TestScope(tenant));
        return await db.InspectionFormVersions.Where(version => version.AreaId == area)
            .Select(version => version.FormId).FirstAsync();
    }

    private sealed class TestScope(Guid tenant) : ICurrentUserScope
    {
        public Guid? TenantId => tenant;
        public string? UserId => null;
        public bool IsAdministrator => true;
    }
}
