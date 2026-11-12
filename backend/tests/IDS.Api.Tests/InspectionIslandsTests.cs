using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using IDS.Api.Controllers;
using IDS.Application.Evaluations;

namespace IDS.Api.Tests;

public sealed class InspectionIslandsTests
{
    private const string Password = "Islands-Tests-Password-123!";

    [Fact]
    public async Task EvaluationAndDashboardFiltersUseTheIndependentIslandAndPreserveDrafts()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "filters");
        var first = (await (await admin.PostAsJsonAsync("/api/inspection-islands", new { name = "Ilha A" }))
            .Content.ReadFromJsonAsync<InspectionIslandDto>())!;
        var second = (await (await admin.PostAsJsonAsync("/api/inspection-islands", new { name = "Ilha B" }))
            .Content.ReadFromJsonAsync<InspectionIslandDto>())!;
        CreateEvaluationRequest Request(Guid islandId) => new(
            new DateOnly(2026, 10, 19), null, null, null, null, null, null, null, null, 10, null, null, [],
            IslandId: islandId);
        var created = await admin.PostAsJsonAsync("/api/evaluations", Request(first.Id));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var evaluation = (await created.Content.ReadFromJsonAsync<EvaluationDto>())!;
        Assert.Equal(first.Id, evaluation.IslandId);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/evaluations", Request(second.Id))).StatusCode);
        var list = (await admin.GetFromJsonAsync<EvaluationDto[]>($"/api/evaluations?islandId={first.Id}"))!;
        Assert.Single(list);
        Assert.Equal("Ilha A", list[0].Island);
        Assert.Equal(1, (await admin.GetFromJsonAsync<DataConsolidationDto>($"/api/dashboard/data?islandId={first.Id}"))!.EvaluationCount);
        Assert.Equal(1, (await admin.GetFromJsonAsync<DashboardSummaryDto>($"/api/dashboard/summary?islandId={first.Id}"))!.EvaluationCount);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/inspection-islands/{first.Id}", new { name = "Renomeada" })).StatusCode);
        Assert.Equal("Renomeada", (await admin.GetFromJsonAsync<EvaluationDto>($"/api/evaluations/{evaluation.Id}"))!.Island);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/inspection-islands/{first.Id}/active", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/evaluations", Request(first.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/evaluations/{evaluation.Id}", Request(first.Id))).StatusCode);
    }

    [Fact]
    public async Task IslandsAreTenantScopedAndCanBeRenamedAndDeactivated()
    {
        using var factory = new CompanyApiFactory();
        using var first = await Administrator(factory, "one");
        using var second = await Administrator(factory, "two");

        var response = await first.PostAsJsonAsync("/api/inspection-islands", new { name = " Ilha A " });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var island = (await response.Content.ReadFromJsonAsync<InspectionIslandDto>())!;
        Assert.Equal("Ilha A", island.Name);
        Assert.True(island.IsActive);
        Assert.Empty((await second.GetFromJsonAsync<InspectionIslandDto[]>("/api/inspection-islands"))!);
        Assert.Equal(HttpStatusCode.NotFound,
            (await second.PutAsJsonAsync($"/api/inspection-islands/{island.Id}", new { name = "Outra" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await first.PostAsJsonAsync("/api/inspection-islands", new { name = "ilha a" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PostAsJsonAsync("/api/inspection-islands", new { name = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await first.PutAsJsonAsync($"/api/inspection-islands/{island.Id}", new { name = "Ilha B" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await first.PutAsJsonAsync($"/api/inspection-islands/{island.Id}/active", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await first.PutAsJsonAsync($"/api/inspection-islands/{island.Id}/active", new { isActive = false })).StatusCode);
        var saved = Assert.Single((await first.GetFromJsonAsync<InspectionIslandDto[]>("/api/inspection-islands"))!);
        Assert.Equal("Ilha B", saved.Name);
        Assert.False(saved.IsActive);
        Assert.Equal(HttpStatusCode.OK,
            (await first.PutAsJsonAsync($"/api/inspection-islands/{island.Id}/active", new { isActive = true })).StatusCode);
        Assert.True(Assert.Single((await first.GetFromJsonAsync<InspectionIslandDto[]>("/api/inspection-islands"))!).IsActive);
    }

    [Fact]
    public async Task CommonUsersCanReadButCannotModifyIslands()
    {
        using var factory = new CompanyApiFactory();
        using var admin = await Administrator(factory, "roles");
        var created = (await (await admin.PostAsJsonAsync("/api/inspection-islands", new { name = "Ilha" }))
            .Content.ReadFromJsonAsync<InspectionIslandDto>())!;
        var email = "island-user@example.com";
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/auth/users",
            new { displayName = "Usuário", email, password = Password, role = "AVALIADOR" })).StatusCode);
        using var user = factory.CreateClient();
        await Login(user, email);
        Assert.Single((await user.GetFromJsonAsync<InspectionIslandDto[]>("/api/inspection-islands"))!);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await user.PostAsJsonAsync("/api/inspection-islands", new { name = "Nova" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await user.PutAsJsonAsync($"/api/inspection-islands/{created.Id}", new { name = "Outra" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await user.PutAsJsonAsync($"/api/inspection-islands/{created.Id}/active", new { isActive = false })).StatusCode);
    }

    private static async Task<HttpClient> Administrator(CompanyApiFactory factory, string suffix)
    {
        var client = factory.CreateClient();
        var email = $"island-admin-{suffix}@example.com";
        var response = await client.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = $"Empresa {suffix}", displayName = "Admin", email, password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await Login(client, email);
        return client;
    }

    private static async Task Login(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }
}
