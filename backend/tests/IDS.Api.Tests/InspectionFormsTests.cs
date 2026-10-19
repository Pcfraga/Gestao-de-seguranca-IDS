using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using IDS.Api.Controllers;
using IDS.Application.Evaluations;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Api.Tests;

public sealed class InspectionFormsTests
{
    private const string Password = "Form-Tests-Password-123!";
    private static readonly Guid Low = Guid.Parse("30000000-0000-0000-0000-000000000001");
    private static readonly Guid Medium = Guid.Parse("30000000-0000-0000-0000-000000000002");
    private static readonly Guid High = Guid.Parse("30000000-0000-0000-0000-000000000003");

    [Fact]
    public async Task CompleteFormsHaveTheirOwnTopicsAndItemsAndShareTheSameCalculations()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "a");
        var first = await CreateForm(admin, Definition("Altura"));
        var second = await CreateForm(admin, Definition("Elétrica", "Instalações", "Painel"));
        Assert.NotEqual(first.Id, second.Id);
        var catalog = await admin.GetFromJsonAsync<JsonElement>($"/api/catalog?formVersionId={first.VersionId}");
        Assert.Equal(2, catalog.GetProperty("categories").GetArrayLength());
        Assert.DoesNotContain(catalog.GetProperty("categories").EnumerateArray(),
            category => category.GetProperty("name").GetString() == "Instalações");

        var inputs = new[]
        {
            new EvaluationObservationRequest(first.Categories.First().Items.First().Id, 2, Low, "Baixa"),
            new EvaluationObservationRequest(first.Categories.First().Items.Last().Id, 1, Medium, "Média"),
            new EvaluationObservationRequest(first.Categories.Last().Items.First().Id, 1, High, "Alta")
        };
        var response = await admin.PostAsJsonAsync("/api/evaluations", Evaluation(first.VersionId, inputs));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var evaluation = (await response.Content.ReadFromJsonAsync<EvaluationDto>())!;
        Assert.Equal(first.VersionId, evaluation.FormVersionId);
        Assert.Equal("Altura", evaluation.FormName);
        Assert.Equal(1, evaluation.FormVersion);
        Assert.Equal(4m, evaluation.Indicators.TotalDeviations);
        Assert.Equal(4.6m, evaluation.Indicators.WeightedDeviationTotal);
        Assert.Equal(0.54m, evaluation.Indicators.Ids);
        Assert.Equal(0.5m, evaluation.Indicators.LowSeverityShare);
        Assert.Equal(0.25m, evaluation.Indicators.MediumSeverityShare);
        Assert.Equal(0.25m, evaluation.Indicators.HighSeverityShare);

        var data = (await admin.GetFromJsonAsync<DataConsolidationDto>("/api/dashboard/data"))!;
        Assert.Equal(4m, data.TotalDeviations);
        Assert.Equal(4.6m, data.WeightedDeviationTotal);
        Assert.Equal(2, data.Categories.Count);
        Assert.Equal(3, data.Items.Count);
        Assert.Equal(4m, data.Categories.Sum(category => category.Quantity));
        Assert.Equal(4m, data.Items.Sum(item => item.Quantity));
        var summary = (await admin.GetFromJsonAsync<DashboardSummaryDto>("/api/dashboard/summary"))!;
        Assert.Equal(0.54m, Assert.Single(summary.Trend).Ids);
    }

    [Fact]
    public async Task EditingCreatesImmutableRevisionAndKeepsDraftsSubmittedRecordsAndCatalogsUnchanged()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "a");
        var form = await CreateForm(admin, Definition("Antigo", "Tópico antigo", "Item antigo"));
        var item = form.Categories.First().Items.First();
        var request = Evaluation(form.VersionId, [new(item.Id, 2, Low, "Original")]);
        var draft = (await (await admin.PostAsJsonAsync("/api/evaluations", request)).Content.ReadFromJsonAsync<EvaluationDto>())!;
        var submitted = (await (await admin.PostAsJsonAsync("/api/evaluations", request)).Content.ReadFromJsonAsync<EvaluationDto>())!;
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/evaluations/{submitted.Id}/submit", null)).StatusCode);

        var update = await admin.PutAsJsonAsync($"/api/inspection-forms/{form.Id}",
            new SaveInspectionFormRequest("Novo", [new("Tópico novo", [new("Item novo")])], 1));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var revised = (await update.Content.ReadFromJsonAsync<InspectionFormDto>())!;
        Assert.Equal(form.Id, revised.Id);
        Assert.Equal(2, revised.Version);
        Assert.NotEqual(form.VersionId, revised.VersionId);
        Assert.Equal("Item novo", Assert.Single(Assert.Single(revised.Categories).Items).Name);
        var list = (await admin.GetFromJsonAsync<InspectionFormDto[]>("/api/inspection-forms"))!;
        Assert.Equal(revised.VersionId, Assert.Single(list, entry => entry.Id == form.Id).VersionId);

        foreach (var evaluationId in new[] { draft.Id, submitted.Id })
        {
            var existing = (await admin.GetFromJsonAsync<EvaluationDto>($"/api/evaluations/{evaluationId}"))!;
            Assert.Equal(form.VersionId, existing.FormVersionId);
            Assert.Equal("Antigo", existing.FormName);
            Assert.Equal("Tópico antigo", existing.Observations.First().Category);
            Assert.Equal("Item antigo", existing.Observations.First().Item);
            Assert.Equal(0.94m, existing.Indicators.Ids);
        }

        var oldCatalog = await admin.GetFromJsonAsync<JsonElement>($"/api/catalog?formVersionId={form.VersionId}");
        Assert.Equal("Tópico antigo", oldCatalog.GetProperty("categories")[0].GetProperty("name").GetString());
        Assert.Equal(2, oldCatalog.GetProperty("categories")[0].GetProperty("items").GetArrayLength());
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/evaluations/{draft.Id}", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync(
            $"/api/evaluations/{draft.Id}", Evaluation(revised.VersionId, []))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync(
            $"/api/inspection-forms/{form.Id}", Definition("Conflito", expectedVersion: 1))).StatusCode);
    }

    [Fact]
    public async Task FormsCannotBeReadEditedOrUsedByOtherCompaniesOrMixedAcrossModels()
    {
        using var factory = new CompanyApiFactory();
        using var adminA = await Administrator(factory, "a");
        using var adminB = await Administrator(factory, "b");
        var first = await CreateForm(adminA, Definition("A"));
        var second = await CreateForm(adminA, Definition("B"));
        Assert.DoesNotContain((await adminB.GetFromJsonAsync<InspectionFormDto[]>("/api/inspection-forms"))!,
            form => form.Id == first.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await adminB.GetAsync($"/api/catalog?formVersionId={first.VersionId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await adminB.PutAsJsonAsync(
            $"/api/inspection-forms/{first.Id}", Definition("Invasão", expectedVersion: 1))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.PostAsJsonAsync(
            "/api/evaluations", Evaluation(first.VersionId, []))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminA.PostAsJsonAsync(
            "/api/evaluations", Evaluation(first.VersionId, [new(second.Categories.First().Items.First().Id, 1, Low, null)]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminA.PostAsJsonAsync(
            "/api/evaluations", Evaluation(null, [new(first.Categories.First().Items.First().Id, 1, Low, null)]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminA.PostAsJsonAsync(
            "/api/evaluations", Evaluation(Guid.NewGuid(), []))).StatusCode);

        Assert.Equal(HttpStatusCode.Created, (await adminA.PostAsJsonAsync("/api/auth/users",
            new { email = "common@example.com", displayName = "Common", password = Password, role = "AVALIADOR" })).StatusCode);
        using var common = factory.CreateClient();
        await Login(common, "common@example.com");
        Assert.Equal(HttpStatusCode.OK, (await common.GetAsync("/api/inspection-forms")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await common.GetAsync($"/api/catalog?formVersionId={first.VersionId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await common.PostAsJsonAsync("/api/inspection-forms", Definition("Não permitido"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await common.PutAsJsonAsync(
            $"/api/inspection-forms/{first.Id}", Definition("Não permitido", expectedVersion: 1))).StatusCode);
    }

    [Fact]
    public async Task DefaultFormCanBeEditedWithoutChangingLegacyEvaluationsOrPreviouslyAddedItems()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "a");
        var initial = Assert.Single((await admin.GetFromJsonAsync<InspectionFormDto[]>("/api/inspection-forms"))!);
        Assert.Equal(Guid.Empty, initial.Id);
        Assert.Null(initial.VersionId);
        Assert.Equal(6, initial.Categories.Count);
        var originalItem = initial.Categories.First().Items.First();
        var evaluation = (await (await admin.PostAsJsonAsync("/api/evaluations",
            Evaluation(null, [new(originalItem.Id, 1, Low, null)]))).Content.ReadFromJsonAsync<EvaluationDto>())!;

        var response = await admin.PutAsJsonAsync($"/api/inspection-forms/{Guid.Empty}", Definition("Meu padrão"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await response.Content.ReadFromJsonAsync<InspectionFormDto>())!;
        Assert.True(updated.IsDefault);
        var list = (await admin.GetFromJsonAsync<InspectionFormDto[]>("/api/inspection-forms"))!;
        Assert.Equal(updated.Id, Assert.Single(list).Id);
        var old = (await admin.GetFromJsonAsync<EvaluationDto>($"/api/evaluations/{evaluation.Id}"))!;
        Assert.Null(old.FormVersionId);
        Assert.Equal("Formulário padrão", old.FormName);
        Assert.Equal(originalItem.Name, Assert.Single(old.Observations).Item);
        Assert.Equal(0.97m, old.Indicators.Ids);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync(
            $"/api/inspection-forms/{Guid.Empty}", Definition("Concorrente"))).StatusCode);
    }

    [Fact]
    public async Task RejectsIncompleteFormDefinitionsAndDoesNotSavePartialVersions()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "a");
        object[] invalid =
        [
            new { name = "", categories = new[] { new { name = "A", items = new[] { new { name = "B" } } } } },
            new { name = "A", categories = Array.Empty<object>() },
            new { name = "A", categories = new[] { new { name = "B", items = Array.Empty<object>() } } },
            new { name = "A", categories = new[] { new { name = "  ", items = new[] { new { name = "B" } } } } },
            new { name = "A", categories = new[] { new { name = "B", items = new[] { new { name = "  " } } } } },
            new { name = "A", categories = (object?)null },
            new { name = "A", categories = new[] { new { name = "B", items = (object?)null } } },
            new { name = "A", categories = new object?[] { null } },
            new { name = "A", categories = new[] { new { name = "B", items = new object?[] { null } } } }
        ];
        foreach (var request in invalid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/inspection-forms", request)).StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdsDbContext>();
        Assert.Empty(await db.InspectionForms.IgnoreQueryFilters().ToArrayAsync());
        Assert.Empty(await db.InspectionFormVersions.IgnoreQueryFilters().ToArrayAsync());
    }

    private static SaveInspectionFormRequest Definition(
        string name, string topic = "Proteção", string item = "Capacete", int expectedVersion = 0) =>
        new(name,
        [
            new(topic, [new(item), new("Luvas")]),
            new("Ambiente", [new("Organização")])
        ], expectedVersion);

    private static CreateEvaluationRequest Evaluation(Guid? version, IReadOnlyCollection<EvaluationObservationRequest> observations) =>
        new(new DateOnly(2026, 10, 19), null, null, null, null, null, null, null, null, 10, null, null, observations, version);

    private static async Task<InspectionFormDto> CreateForm(HttpClient client, SaveInspectionFormRequest request)
    {
        var response = await client.PostAsJsonAsync("/api/inspection-forms", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<InspectionFormDto>())!;
    }

    private static async Task<HttpClient> Administrator(CompanyApiFactory factory, string suffix)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = $"Forms {suffix}", displayName = "Admin", email = $"admin-{suffix}@example.com", password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await Login(client, $"admin-{suffix}@example.com");
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
