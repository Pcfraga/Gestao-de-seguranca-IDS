using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using IDS.Api.Controllers;
using IDS.Application.Evaluations;

namespace IDS.Api.Tests;

public sealed class InspectionAreasTests
{
    private const string Password = "Area-Tests-Password-123!";
    private static readonly Guid Low = Guid.Parse("30000000-0000-0000-0000-000000000001");

    [Fact]
    public async Task AreasAndFormTypesFilterEveryStatisticsSurfaceAndKeepRevisionsTogether()
    {
        using var factory = new CompanyApiFactory();
        using var client = await Admin(factory, "a");
        var environment = await Area(client, "Meio Ambiente");
        var quality = await Area(client, "Qualidade");
        var water = await Form(client, "Água", environment.Id);
        var waste = await Form(client, "Resíduos", environment.Id);
        var product = await Form(client, "Produto", quality.Id);
        await Evaluation(client, water.VersionId, water.Categories.First().Items.First().Id, 2);
        await Evaluation(client, waste.VersionId, waste.Categories.First().Items.First().Id, 7);
        await Evaluation(client, product.VersionId, product.Categories.First().Items.First().Id, 11);
        var legacyItem = Guid.Parse("20000000-0000-0000-0000-000000000001");
        await Evaluation(client, null, legacyItem, 3);

        var update = await client.PutAsJsonAsync($"/api/inspection-forms/{water.Id}",
            Definition("Água revisada", environment.Id, 1));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var revision = (await update.Content.ReadFromJsonAsync<InspectionFormDto>())!;
        await Evaluation(client, revision.VersionId, revision.Categories.First().Items.First().Id, 4);

        await AssertScope(client, $"areaId={environment.Id}&formId={water.Id}", 2, 6);
        await AssertScope(client, $"areaId={environment.Id}&formId={waste.Id}", 1, 7);
        await AssertScope(client, $"areaId={environment.Id}", 3, 13);
        await AssertScope(client, $"areaId={quality.Id}&formId={product.Id}", 1, 11);
        await AssertScope(client, $"areaId={Guid.Empty}&formId={Guid.Empty}", 1, 3);
        await AssertScope(client, $"areaId={quality.Id}&formId={water.Id}", 0, 0);
        var old = (await client.GetFromJsonAsync<EvaluationDto[]>($"/api/evaluations?formId={water.Id}"))!;
        Assert.Contains(old, evaluation => evaluation.FormVersion == 1 && evaluation.AreaId == environment.Id);
        Assert.Contains(old, evaluation => evaluation.FormVersion == 2 && evaluation.AreaName == "Meio Ambiente");

        var defaultEdit = await client.PutAsJsonAsync($"/api/inspection-forms/{Guid.Empty}",
            Definition("Padrão revisado", Guid.Empty));
        Assert.Equal(HttpStatusCode.OK, defaultEdit.StatusCode);
        var defaultForm = (await defaultEdit.Content.ReadFromJsonAsync<InspectionFormDto>())!;
        await Evaluation(client, defaultForm.VersionId, defaultForm.Categories.First().Items.First().Id, 5);
        await AssertScope(client, $"areaId={Guid.Empty}&formId={Guid.Empty}", 2, 8);
        await AssertScope(client, $"areaId={Guid.Empty}&formId={defaultForm.Id}", 2, 8);
    }

    [Fact]
    public async Task AreaOwnershipValidationAndFixedFormAreaProtectHistoricalSeparation()
    {
        using var factory = new CompanyApiFactory();
        using var first = await Admin(factory, "a");
        using var second = await Admin(factory, "b");
        var area = await Area(first, "Qualidade");
        var form = await Form(first, "Produto", area.Id);
        Assert.DoesNotContain((await second.GetFromJsonAsync<InspectionAreaDto[]>("/api/inspection-areas"))!,
            entry => entry.Id == area.Id);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await second.PostAsJsonAsync("/api/inspection-forms", Definition("Outro", area.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync($"/api/inspection-forms/{form.Id}", Definition("Mover", Guid.Empty, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PostAsJsonAsync("/api/inspection-areas", new { name = " qualidade " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PostAsJsonAsync("/api/inspection-areas", new { name = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync($"/api/inspection-forms/{Guid.Empty}", Definition("Mover padrão", area.Id))).StatusCode);
        await AssertScope(second, $"areaId={area.Id}&formId={form.Id}", 0, 0);
        var commonEmail = "common-area@example.com";
        Assert.Equal(HttpStatusCode.Created, (await first.PostAsJsonAsync("/api/auth/users",
            new { displayName = "Comum", email = commonEmail, password = Password, role = "AVALIADOR" })).StatusCode);
        using var common = factory.CreateClient();
        await Login(common, commonEmail);
        Assert.Contains((await common.GetFromJsonAsync<InspectionAreaDto[]>("/api/inspection-areas"))!,
            entry => entry.Id == area.Id);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await common.PostAsJsonAsync("/api/inspection-areas", new { name = "Não permitida" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await common.PostAsJsonAsync("/api/catalog/sites", new { name = "Local não permitido", projectOrIsland = (string?)null })).StatusCode);
        foreach (var kind in new[] { "Client", "Contractor", "Subcontractor" })
        {
            Assert.Equal(HttpStatusCode.Forbidden,
                (await common.PostAsJsonAsync("/api/catalog/organizations", new { name = $"Cadastro não permitido {kind}", kind })).StatusCode);
        }
    }

    private static async Task AssertScope(HttpClient client, string query, int count, decimal quantity)
    {
        var list = (await client.GetFromJsonAsync<EvaluationDto[]>($"/api/evaluations?{query}"))!;
        var data = (await client.GetFromJsonAsync<DataConsolidationDto>($"/api/dashboard/data?{query}"))!;
        var summary = (await client.GetFromJsonAsync<DashboardSummaryDto>($"/api/dashboard/summary?{query}"))!;
        Assert.Equal(count, list.Length);
        Assert.Equal(count, data.EvaluationCount);
        Assert.Equal(count * 10, data.ObservedPeople);
        Assert.Equal(quantity, data.TotalDeviations);
        Assert.Equal(quantity * 0.3m, data.WeightedDeviationTotal);
        Assert.Equal(quantity, data.Days.Sum(day => day.TotalDeviations));
        Assert.Equal(quantity, data.Items.Sum(item => item.Quantity));
        Assert.Equal(count, summary.EvaluationCount);
        Assert.Equal(quantity, summary.LowSeverityDeviations);
        Assert.Equal(count, summary.Trend.Count);
    }

    private static SaveInspectionFormRequest Definition(string name, Guid areaId, int version = 0) =>
        new(name, [new("Tópico", [new("Item")])], version, areaId);

    private static async Task<InspectionFormDto> Form(HttpClient client, string name, Guid areaId)
    {
        var response = await client.PostAsJsonAsync("/api/inspection-forms", Definition(name, areaId));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<InspectionFormDto>())!;
    }

    private static async Task<InspectionAreaDto> Area(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/inspection-areas", new { name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<InspectionAreaDto>())!;
    }

    private static async Task Evaluation(HttpClient client, Guid? versionId, Guid itemId, decimal quantity)
    {
        var response = await client.PostAsJsonAsync("/api/evaluations",
            new CreateEvaluationRequest(new DateOnly(2026, 10, 19), null, null, null, null, null,
                null, null, null, 10, null, null, [new(itemId, quantity, Low, null)], versionId));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task<HttpClient> Admin(CompanyApiFactory factory, string suffix)
    {
        var client = factory.CreateClient();
        var email = $"area-{suffix}@example.com";
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = $"Areas {suffix}", displayName = "Admin", email, password = Password })).StatusCode);
        await Login(client, email);
        return client;
    }

    private static async Task Login(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
    }
}
