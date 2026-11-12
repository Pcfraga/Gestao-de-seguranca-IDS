using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using IDS.Api.Controllers;
using IDS.Application.Evaluations;
using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Api.Tests;

public sealed class OperationalCatalogTests
{
    [Fact]
    public async Task LegacyProjectAliasesShareFiltersAndRenameWithoutLosingOriginalReferences()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "aliases");
        var firstResponse = await admin.PostAsJsonAsync("/api/catalog/sites", new { name = "Projeto" });
        var canonical = (await firstResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var secondResponse = await admin.PostAsJsonAsync("/api/catalog/sites", new { name = "Projeto antigo" });
        var alias = (await secondResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        CreateEvaluationRequest Request(Guid site) => new(new DateOnly(2026, 10, 1), null, site, null, null, null, null, null, null, 10, null, null, []);
        var first = (await (await admin.PostAsJsonAsync("/api/evaluations", Request(canonical))).Content.ReadFromJsonAsync<EvaluationDto>())!;
        var second = (await (await admin.PostAsJsonAsync("/api/evaluations", Request(alias))).Content.ReadFromJsonAsync<EvaluationDto>())!;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IdsDbContext>();
            await db.Sites.IgnoreQueryFilters().Where(value => value.Id == alias)
                .ExecuteUpdateAsync(setters => setters.SetProperty(value => value.CanonicalSiteId, canonical));
        }

        var catalog = await admin.GetFromJsonAsync<JsonElement>("/api/catalog");
        Assert.Single(catalog.GetProperty("sites").EnumerateArray());
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/catalog/sites", new { name = " projeto " })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/sites/{canonical}", new { name = "Renomeado" })).StatusCode);
        var results = (await admin.GetFromJsonAsync<EvaluationDto[]>($"/api/evaluations?siteId={canonical}"))!;
        Assert.Equal(2, results.Length);
        Assert.All(results, evaluation => { Assert.Equal(canonical, evaluation.SiteId); Assert.Equal("Renomeado", evaluation.Site); });
        var data = (await admin.GetFromJsonAsync<DataConsolidationDto>($"/api/dashboard/data?siteId={canonical}"))!;
        Assert.Equal(2, data.EvaluationCount);
        Assert.Single(data.MonthlyGroups);
        Assert.Equal(2, (await admin.GetFromJsonAsync<DashboardSummaryDto>($"/api/dashboard/summary?siteId={canonical}"))!.EvaluationCount);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/evaluations/{second.Id}", Request(canonical))).StatusCode);
        Assert.NotEqual(first.Id, second.Id);
    }

    [Fact]
    public async Task RenameAndDeactivationPreserveExistingEvaluationsAndTenantIsolation()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "one");
        using var other = await Administrator(factory, "two");
        var site = await admin.PostAsJsonAsync("/api/catalog/sites", new { name = "Projeto A" });
        var siteId = (await site.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var org = await admin.PostAsJsonAsync("/api/catalog/organizations", new { name = "Contratada A", kind = "Contractor" });
        var orgId = (await org.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var request = new CreateEvaluationRequest(new DateOnly(2026, 10, 1), null, siteId, null, orgId, null,
            null, null, null, 10, null, null, []);
        var evaluationResponse = await admin.PostAsJsonAsync("/api/evaluations", request);
        Assert.Equal(HttpStatusCode.Created, evaluationResponse.StatusCode);
        var evaluation = (await evaluationResponse.Content.ReadFromJsonAsync<EvaluationDto>())!;

        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"/api/catalog/sites/{siteId}", new { name = "Outro" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"/api/catalog/organizations/{orgId}/active", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/sites/{siteId}", new { name = "Projeto B" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/organizations/{orgId}", new { name = "Contratada B" })).StatusCode);
        var renamed = (await admin.GetFromJsonAsync<EvaluationDto>($"/api/evaluations/{evaluation.Id}"))!;
        Assert.Equal("Projeto B", renamed.Site);
        Assert.Equal("Contratada B", renamed.Contractor);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/sites/{siteId}/active", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/organizations/{orgId}/active", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/evaluations", request)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/evaluations/{evaluation.Id}", request)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/sites/{siteId}/active", new { isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/catalog/organizations/{orgId}/active", new { isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/evaluations", request)).StatusCode);
    }

    [Fact]
    public async Task DefaultAreaCanBeRenamedButNotDeactivated()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "default");
        using var other = await Administrator(factory, "other");
        var request = new CreateEvaluationRequest(new DateOnly(2026, 10, 1), null, null, null, null, null,
            null, null, null, 10, null, null, []);
        var response = await admin.PostAsJsonAsync("/api/evaluations", request);
        var evaluation = (await response.Content.ReadFromJsonAsync<EvaluationDto>())!;
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/inspection-areas/{Guid.Empty}", new { name = "Segurança" })).StatusCode);
        Assert.Equal("Segurança", (await admin.GetFromJsonAsync<EvaluationDto>($"/api/evaluations/{evaluation.Id}"))!.AreaName);
        Assert.Equal("Segurança", (await admin.GetFromJsonAsync<InspectionFormDto[]>("/api/inspection-forms"))!.First(form => form.IsDefault).AreaName);
        Assert.Equal("Segurança", (await admin.GetFromJsonAsync<InspectionAreaDto[]>("/api/inspection-areas"))!.First().Name);
        Assert.Equal("Saúde e Segurança do Trabalho", (await other.GetFromJsonAsync<InspectionAreaDto[]>("/api/inspection-areas"))!.First().Name);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/inspection-areas/{Guid.Empty}/active", new { isActive = false })).StatusCode);
    }

    [Fact]
    public async Task AreaRenamePropagatesToExistingFormsAndDeactivationPreventsNewForms()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "area");
        var response = await admin.PostAsJsonAsync("/api/inspection-areas", new { name = "Qualidade" });
        var area = (await response.Content.ReadFromJsonAsync<InspectionAreaDto>())!;
        var definition = new SaveInspectionFormRequest("Inspeção", [new("Tópico", [new("Item")])], 0, area.Id);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/inspection-forms", definition)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/inspection-areas/{area.Id}", new { name = "Qualidade nova" })).StatusCode);
        Assert.Contains((await admin.GetFromJsonAsync<InspectionFormDto[]>("/api/inspection-forms"))!,
            form => form.AreaId == area.Id && form.AreaName == "Qualidade nova");
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/inspection-areas/{area.Id}/active", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/inspection-forms", definition)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/inspection-areas/{area.Id}/active", new { isActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/inspection-forms", definition)).StatusCode);
    }

    private static async Task<HttpClient> Administrator(CompanyApiFactory factory, string suffix)
    {
        var client = factory.CreateClient();
        var email = $"catalog-{suffix}@example.com";
        const string password = "Catalog-Tests-Password-123!";
        var registration = await client.PostAsJsonAsync("/api/auth/register-company", new { companyName = suffix, displayName = "Admin", email, password });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        var login = (await (await client.PostAsJsonAsync("/api/auth/login", new { email, password })).Content.ReadFromJsonAsync<LoginResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
        return client;
    }
}
