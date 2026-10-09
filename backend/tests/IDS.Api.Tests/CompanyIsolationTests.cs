using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using IDS.Api.Controllers;
using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace IDS.Api.Tests;

public sealed class CompanyIsolationTests
{
    private const string Password = "Company-Test-Password-123!";

    [Fact]
    public async Task EachAdministratorManagesOnlyTheirCompanyAndCommonUsersSeeOwnEvaluations()
    {
        using var factory = new CompanyApiFactory();
        using var adminA = factory.CreateClient();
        using var adminB = factory.CreateClient();
        using var commonA = factory.CreateClient();
        await RegisterAndLogin(adminA, "Company A", "admin-a@example.com");
        await RegisterAndLogin(adminB, "Company B", "admin-b@example.com");

        var userResponse = await adminA.PostAsJsonAsync("/api/auth/users",
            new { email = "common-a@example.com", displayName = "Common A", password = Password, role = "AVALIADOR" });
        Assert.Equal(HttpStatusCode.Created, userResponse.StatusCode);
        await Login(commonA, "common-a@example.com", Password);
        var usersA = (await adminA.GetFromJsonAsync<UserSummary[]>("/api/auth/users"))!;
        var usersB = (await adminB.GetFromJsonAsync<UserSummary[]>("/api/auth/users"))!;
        Assert.Equal(2, usersA.Length);
        Assert.Single(usersB);
        Assert.DoesNotContain(usersA, user => user.Email == "admin-b@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await commonA.GetAsync("/api/auth/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await commonA.PostAsJsonAsync("/api/auth/users",
            new { email = "forbidden@example.com", displayName = "Forbidden", password = Password, role = "ADMINISTRADOR" })).StatusCode);

        var evaluationA = await CreateEvaluation(adminA);
        var commonEvaluation = await CreateEvaluation(commonA);
        var evaluationB = await CreateEvaluation(adminB);
        Assert.Equal(2, (await adminA.GetFromJsonAsync<JsonElement[]>("/api/evaluations"))!.Length);
        Assert.Single((await adminB.GetFromJsonAsync<JsonElement[]>("/api/evaluations"))!);
        var commonList = (await commonA.GetFromJsonAsync<JsonElement[]>("/api/evaluations"))!;
        Assert.Single(commonList);
        Assert.Equal(commonEvaluation, commonList[0].GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.NotFound, (await adminA.GetAsync($"/api/evaluations/{evaluationB}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await commonA.GetAsync($"/api/evaluations/{evaluationA}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await adminB.PutAsJsonAsync($"/api/evaluations/{evaluationA}", EvaluationRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await adminB.PostAsync($"/api/evaluations/{evaluationA}/submit", null)).StatusCode);

        Assert.Equal(2, (await adminA.GetFromJsonAsync<JsonElement>("/api/dashboard/data")).GetProperty("evaluationCount").GetInt32());
        Assert.Equal(1, (await adminB.GetFromJsonAsync<JsonElement>("/api/dashboard/data")).GetProperty("evaluationCount").GetInt32());
        Assert.Equal(1, (await commonA.GetFromJsonAsync<JsonElement>("/api/dashboard/data")).GetProperty("evaluationCount").GetInt32());
        Assert.Equal(2, (await adminA.GetFromJsonAsync<JsonElement>("/api/dashboard/summary")).GetProperty("evaluationCount").GetInt32());
        Assert.Equal(1, (await adminB.GetFromJsonAsync<JsonElement>("/api/dashboard/summary")).GetProperty("evaluationCount").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await adminA.PutAsJsonAsync($"/api/auth/users/{usersB[0].Id}/active", new { active = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await adminA.PutAsJsonAsync($"/api/auth/users/{usersB[0].Id}/password", new { password = "Other-Password-123!" })).StatusCode);
    }

    [Fact]
    public async Task CatalogReportsAndBrandingAreCompanyScoped()
    {
        using var factory = new CompanyApiFactory();
        using var adminA = factory.CreateClient();
        using var adminB = factory.CreateClient();
        await RegisterAndLogin(adminA, "Company A", "admin-a@example.com");
        await RegisterAndLogin(adminB, "Company B", "admin-b@example.com");
        var siteResponse = await adminA.PostAsJsonAsync("/api/catalog/sites", new { name = "Site A", projectOrIsland = "A" });
        Assert.Equal(HttpStatusCode.Created, siteResponse.StatusCode);
        var siteId = (await siteResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var orgResponse = await adminA.PostAsJsonAsync("/api/catalog/organizations", new { name = "Contractor A", kind = "Contractor" });
        Assert.Equal(HttpStatusCode.Created, orgResponse.StatusCode);
        var orgId = (await orgResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var catalogB = await adminB.GetFromJsonAsync<JsonElement>("/api/catalog");
        Assert.Equal(0, catalogB.GetProperty("sites").GetArrayLength());
        Assert.Equal(0, catalogB.GetProperty("organizations").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.PostAsJsonAsync("/api/evaluations", EvaluationRequest(siteId))).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await adminA.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new { contractorOrganizationId = orgId, siteId, value = 90m })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.GetAsync($"/api/reports/ipf/2026?contractorId={orgId}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.GetAsync($"/api/reports/ipf/2026/10/suggestion?contractorId={orgId}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await adminB.PutAsJsonAsync("/api/reports/ipf/2026/10",
            new { contractorOrganizationId = orgId, siteId, value = 20m })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await adminA.PutAsJsonAsync("/api/settings/report",
            new { companyName = "Brand A", tagline = "", logoDataUrl = (string?)null, primaryColor = "#123456" })).StatusCode);
        Assert.Equal("Brand A", (await adminA.GetFromJsonAsync<JsonElement>("/api/settings/report")).GetProperty("companyName").GetString());
        Assert.Equal("Company B", (await adminB.GetFromJsonAsync<JsonElement>("/api/settings/report")).GetProperty("companyName").GetString());
        Assert.Equal("Company B", (await adminB.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("companyName").GetString());
        Assert.Equal(HttpStatusCode.Created, (await adminB.PostAsJsonAsync("/api/catalog/sites", new { name = "Site A", projectOrIsland = "A" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await adminB.PostAsJsonAsync("/api/catalog/organizations", new { name = "Contractor A", kind = "Contractor" })).StatusCode);
    }

    [Fact]
    public async Task SignupIsAtomicAndPasswordsCanBeChangedAndReset()
    {
        using var factory = new CompanyApiFactory();
        using var admin = factory.CreateClient();
        await RegisterAndLogin(admin, "Company A", "admin-a@example.com");
        var duplicate = await admin.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = "Duplicate", displayName = "Duplicate", email = "admin-a@example.com", password = Password });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<IdsDbContext>().Tenants.CountAsync());
        }
        var missing = await admin.PutAsJsonAsync("/api/auth/me/password", new { currentPassword = Password, newPassword = "" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        var incorrect = await admin.PutAsJsonAsync("/api/auth/me/password", new { currentPassword = "Incorrect", newPassword = "New-Company-Password-456!" });
        Assert.Equal(HttpStatusCode.BadRequest, incorrect.StatusCode);
        var change = await admin.PutAsJsonAsync("/api/auth/me/password", new { currentPassword = Password, newPassword = "New-Company-Password-456!" });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        using var loginClient = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await loginClient.PostAsJsonAsync("/api/auth/login", new { email = "admin-a@example.com", password = Password })).StatusCode);
        await Login(loginClient, "admin-a@example.com", "New-Company-Password-456!");
        var user = Assert.Single((await loginClient.GetFromJsonAsync<UserSummary[]>("/api/auth/users"))!);
        Assert.Equal(HttpStatusCode.NoContent, (await loginClient.PutAsJsonAsync($"/api/auth/users/{user.Id}/password", new { password = "Reset-Company-Password-789!" })).StatusCode);
        await Login(loginClient, "admin-a@example.com", "Reset-Company-Password-789!");
    }

    [Fact]
    public async Task TokensWithoutCompanyOrWithWrongMembershipAreRejected()
    {
        using var factory = new CompanyApiFactory();
        using var admin = factory.CreateClient();
        await RegisterAndLogin(admin, "Company A", "admin-a@example.com");
        var user = Assert.Single((await admin.GetFromJsonAsync<UserSummary[]>("/api/auth/users"))!);
        var configuration = factory.Services.GetRequiredService<IConfiguration>();
        foreach (var companyClaim in new[] { null, Guid.NewGuid().ToString() })
        {
            var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Role, "ADMINISTRADOR") };
            if (companyClaim is not null) claims.Add(new Claim("tenant_id", companyClaim));
            var token = new JwtSecurityToken(
                issuer: configuration["AUTH_ISSUER"] ?? "IDS.Api",
                audience: configuration["AUTH_AUDIENCE"] ?? "IDS.Frontend",
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["AUTH_SIGNING_KEY"]!)),
                    SecurityAlgorithms.HmacSha256));
            using var invalid = factory.CreateClient();
            invalid.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
            Assert.Equal(HttpStatusCode.Unauthorized, (await invalid.GetAsync("/api/auth/users")).StatusCode);
        }
    }

    private static async Task RegisterAndLogin(HttpClient client, string company, string email)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register-company",
            new { companyName = company, displayName = company + " Admin", email, password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await Login(client, email, Password);
    }

    private static async Task Login(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
    }

    private static object EvaluationRequest(Guid? siteId = null) => new
    {
        evaluationDate = "2026-10-01", siteId, observedPeople = 10m,
        observations = new[]
        {
            new { checklistItemId = Guid.Parse("20000000-0000-0000-0000-000000000001"),
                severityLevelId = Guid.Parse("30000000-0000-0000-0000-000000000001"), quantity = 1m }
        }
    };

    private static async Task<Guid> CreateEvaluation(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/evaluations", EvaluationRequest());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }
}
