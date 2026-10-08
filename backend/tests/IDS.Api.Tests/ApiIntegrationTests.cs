using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IDS.Api.Tests;

public sealed class ApiIntegrationTests(IdsApiFactory factory) : IClassFixture<IdsApiFactory>
{
    [Fact]
    public async Task ProtectedCatalogRequiresAuthentication()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/catalog");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ReadinessReportsUnavailableDatabase()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health/ready");
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("not_ready", payload, StringComparison.Ordinal);
        Assert.Contains("unavailable", payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DevelopmentCorsAcceptsTheViteFallbackPort()
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", "http://localhost:5174");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:5174", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Theory]
    [InlineData("https://ids.example.com", true)]
    [InlineData("https://ids-secondary.example.com", true)]
    [InlineData("https://untrusted.example.com", false)]
    [InlineData("http://localhost:5173", false)]
    [InlineData("http://localhost:5174", false)]
    public async Task ProductionCorsOnlyAcceptsConfiguredOrigins(string origin, bool allowed)
    {
        using var productionFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("ALLOWED_ORIGINS", " https://ids.example.com, https://ids-secondary.example.com ");
        });
        using var client = productionFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type,authorization");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        if (allowed)
        {
            Assert.Equal(origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        }
        else
        {
            Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        }
    }

    [Fact]
    public async Task ProductionReadinessDoesNotExposeDatabaseException()
    {
        using var productionFactory = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
        using var client = productionFactory.CreateClient();

        var response = await client.GetAsync("/api/health/ready");
        var payload = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("unavailable", payload!["database"]);
        Assert.False(payload.ContainsKey("error"));
    }

    [Fact]
    public void ModelMatchesExistingMigrations()
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<IdsDbContext>();

        Assert.False(dbContext.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task LoginReturnsServiceUnavailableWhenDatabaseIsOffline()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "user@example.com", password = "Test-Only-Password-123!" });
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("database_unavailable", payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task BootstrapReturnsUnauthorizedWhenSetupKeyIsIncorrect()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/bootstrap-admin", new
        {
            setupKey = "incorrect-setup-key",
            email = "admin@example.com",
            displayName = "Admin",
            password = "Test-Only-Password-123!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task BootstrapReturnsServiceUnavailableWhenKeyIsCorrectButDatabaseIsOffline()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/bootstrap-admin", new
        {
            setupKey = "integration-tests-only-bootstrap-key",
            email = "admin@example.com",
            displayName = "Admin",
            password = "Test-Only-Password-123!"
        });
        var payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("database_unavailable", payload, StringComparison.Ordinal);
    }

    [Fact]
    public void PasswordPolicyKeepsLengthMinimumWithoutCompositionRules()
    {
        var options = factory.Services.GetRequiredService<IOptions<IdentityOptions>>().Value.Password;

        Assert.Equal(8, options.RequiredLength);
        Assert.False(options.RequireDigit);
        Assert.False(options.RequireLowercase);
        Assert.False(options.RequireUppercase);
        Assert.False(options.RequireNonAlphanumeric);
    }
}