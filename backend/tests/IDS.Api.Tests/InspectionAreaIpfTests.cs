using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using IDS.Api.Controllers;
using IDS.Application.Evaluations;
using IDS.Application.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Api.Tests;

public sealed class InspectionAreaIpfTests
{
    private const string Password = "Area-Ipf-Tests-Password-123!";
    private static readonly Guid Low = Guid.Parse("30000000-0000-0000-0000-000000000001");
    private static readonly Guid Medium = Guid.Parse("30000000-0000-0000-0000-000000000002");
    private static readonly Guid High = Guid.Parse("30000000-0000-0000-0000-000000000003");

    [Fact]
    public async Task HistorySuggestionsAndUpsertsAreSeparatedByAreaFormAndTenant()
    {
        using var factory = new CompanyApiFactory();
        using var adminA = await Administrator(factory, "a");
        using var adminB = await Administrator(factory, "b");

        var areaResponse = await adminA.PostAsJsonAsync("/api/inspection-areas", new { name = "Meio ambiente" });
        Assert.Equal(HttpStatusCode.Created, areaResponse.StatusCode);
        var areaId = (await areaResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var contractorResponse = await adminA.PostAsJsonAsync("/api/catalog/organizations",
            new { name = "Contratada IPF", kind = "Contractor" });
        Assert.Equal(HttpStatusCode.Created, contractorResponse.StatusCode);
        var contractorId = (await contractorResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var defaultForm = await SaveForm(adminA, Guid.Empty, "SST padrão");
        var areaForm = await SaveForm(adminA, areaId, "Meio ambiente");
        var otherAreaResponse = await adminA.PostAsJsonAsync("/api/inspection-areas", new { name = "Qualidade" });
        Assert.Equal(HttpStatusCode.Created, otherAreaResponse.StatusCode);
        var otherAreaId = (await otherAreaResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var otherAreaForm = await SaveForm(adminA, otherAreaId, "Qualidade");
        Assert.True(defaultForm.IsDefault);
        Assert.False(areaForm.IsDefault);

        var defaultEvaluation = await CreateEvaluation(adminA, defaultForm, contractorId, 1);
        var areaEvaluation = await CreateEvaluation(adminA, areaForm, contractorId, 4);
        Assert.NotEqual(defaultEvaluation.Indicators.Ids, areaEvaluation.Indicators.Ids);

        var defaultUpsert = await adminA.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new UpsertMonthlyIpfRequest(contractorId, null, 7.22m, Guid.Empty, Guid.Empty));
        var areaUpsert = await adminA.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new UpsertMonthlyIpfRequest(contractorId, null, 8.11m, areaId, areaForm.Id));
        Assert.Equal(HttpStatusCode.OK, defaultUpsert.StatusCode);
        Assert.Equal(HttpStatusCode.OK, areaUpsert.StatusCode);

        var defaultHistory = await adminA.GetFromJsonAsync<IpfAnnualHistoryDto>(
            $"/api/reports/ipf/2026?contractorId={contractorId}&areaId={Guid.Empty}&formId={Guid.Empty}");
        var areaHistory = await adminA.GetFromJsonAsync<IpfAnnualHistoryDto>(
            $"/api/reports/ipf/2026?contractorId={contractorId}&areaId={areaId}&formId={areaForm.Id}");
        Assert.Null(defaultHistory!.AreaId);
        Assert.Null(defaultHistory.FormId);
        Assert.Equal("Saúde e Segurança do Trabalho", defaultHistory.AreaName);
        Assert.Equal("Formulário padrão", defaultHistory.FormName);
        Assert.Equal(7.22m, Assert.Single(defaultHistory.Months).Value);
        Assert.Equal(areaId, areaHistory!.AreaId);
        Assert.Equal(areaForm.Id, areaHistory.FormId);
        Assert.Equal("Meio ambiente", areaHistory.AreaName);
        Assert.Equal("Meio ambiente", areaHistory.FormName);
        Assert.Equal(8.11m, Assert.Single(areaHistory.Months).Value);

        var defaultSuggestion = await adminA.GetFromJsonAsync<MonthlyIpfSuggestionDto>(
            $"/api/reports/ipf/2026/10/suggestion?contractorId={contractorId}&areaId={Guid.Empty}&formId={Guid.Empty}");
        var areaSuggestion = await adminA.GetFromJsonAsync<MonthlyIpfSuggestionDto>(
            $"/api/reports/ipf/2026/10/suggestion?contractorId={contractorId}&areaId={areaId}&formId={areaForm.Id}");
        Assert.Equal(1, defaultSuggestion!.EvaluationCount);
        Assert.Equal(defaultEvaluation.Indicators.Ids, defaultSuggestion.Average);
        Assert.Null(defaultSuggestion.AreaId);
        Assert.Null(defaultSuggestion.FormId);
        Assert.Equal(1, areaSuggestion!.EvaluationCount);
        Assert.Equal(areaEvaluation.Indicators.Ids, areaSuggestion.Average);
        Assert.Equal(areaId, areaSuggestion.AreaId);
        Assert.Equal(areaForm.Id, areaSuggestion.FormId);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminA.GetAsync(
            $"/api/reports/ipf/2026?contractorId={contractorId}&areaId={areaId}&formId={otherAreaForm.Id}")).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IDS.Infrastructure.Persistence.IdsDbContext>();
        Assert.Equal(2, await db.MonthlyIpfRecords.IgnoreQueryFilters()
            .CountAsync(record => record.ContractorOrganizationId == contractorId));

        var contractorBResponse = await adminB.PostAsJsonAsync("/api/catalog/organizations",
            new { name = "Contratada B", kind = "Contractor" });
        Assert.Equal(HttpStatusCode.Created, contractorBResponse.StatusCode);
        var contractorBId = (await contractorBResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.GetAsync(
            $"/api/reports/ipf/2026?contractorId={contractorBId}&areaId={areaId}&formId={areaForm.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new UpsertMonthlyIpfRequest(contractorBId, null, 9m, areaId, areaForm.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.GetAsync(
            $"/api/reports/ipf/2026?contractorId={contractorBId}&areaId={Guid.Empty}&formId={areaForm.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.GetAsync(
            $"/api/reports/ipf/2026?contractorId={contractorBId}&areaId={areaId}&formId={Guid.Empty}")).StatusCode);
    }

    private static async Task<InspectionFormDto> SaveForm(HttpClient client, Guid areaId, string name)
    {
        var definition = new SaveInspectionFormRequest(
            name,
            [
                new InspectionFormTopicRequest("Inspeção", [
                    new InspectionFormItemRequest("Item 1"),
                    new InspectionFormItemRequest("Item 2"),
                    new InspectionFormItemRequest("Item 3")
                ])
            ],
            0,
            areaId);
        var path = areaId == Guid.Empty
            ? $"/api/inspection-forms/{Guid.Empty}"
            : "/api/inspection-forms";
        var response = areaId == Guid.Empty
            ? await client.PutAsJsonAsync(path, definition)
            : await client.PostAsJsonAsync(path, definition);
        Assert.Equal(areaId == Guid.Empty ? HttpStatusCode.OK : HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<InspectionFormDto>())!;
    }

    private static async Task<EvaluationDto> CreateEvaluation(
        HttpClient client,
        InspectionFormDto form,
        Guid contractorId,
        decimal lowQuantity)
    {
        var items = form.Categories.Single().Items.ToArray();
        var request = new CreateEvaluationRequest(
            new DateOnly(2026, 10, 19),
            null,
            null,
            null,
            contractorId,
            null,
            null,
            null,
            null,
            10m,
            null,
            null,
            [
                new(items[0].Id, lowQuantity, Low, null),
                new(items[1].Id, 1, Medium, null),
                new(items[2].Id, 1, High, null)
            ],
            form.VersionId);
        var response = await client.PostAsJsonAsync("/api/evaluations", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<EvaluationDto>())!;
    }

    private static async Task<HttpClient> Administrator(CompanyApiFactory factory, string suffix)
    {
        var client = factory.CreateClient();
        var email = $"ipf-admin-{suffix}@example.com";
        var response = await client.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = $"IPF {suffix}", displayName = "Admin", email, password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = (await login.Content.ReadFromJsonAsync<LoginResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return client;
    }
}
