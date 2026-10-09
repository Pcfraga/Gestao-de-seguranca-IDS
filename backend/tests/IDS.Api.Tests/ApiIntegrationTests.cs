using System.Net;
using System.Net.Http.Json;
using IDS.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
    public async Task CreatingUsersRequiresAuthentication()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/users", new
        {
            email = "user@example.com",
            displayName = "New User",
            password = "Test-Only-Password-123!",
            role = "AVALIADOR"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public void CreatingUsersRequiresAdministratorRole()
    {
        var method = typeof(AuthController).GetMethod(nameof(AuthController.CreateUser))!;
        var authorization = Assert.Single(method.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());

        Assert.Equal("ADMINISTRADOR", authorization.Roles);
        Assert.Empty(method.GetCustomAttributes(typeof(AllowAnonymousAttribute), true));
    }

    [Fact]
    public async Task ChangingOwnPasswordRequiresAuthentication()
    {
        using var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync("/api/auth/me/password", new
        {
            currentPassword = "Test-Only-Password-123!",
            newPassword = "Test-Only-New-Password-456!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public void ChangingOwnPasswordIsAvailableToAllAuthenticatedRoles()
    {
        var method = typeof(AuthController).GetMethod(nameof(AuthController.ChangePassword))!;
        var authorization = Assert.Single(method.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());

        Assert.Null(authorization.Roles);
        Assert.Empty(method.GetCustomAttributes(typeof(AllowAnonymousAttribute), true));
    }

    [Fact]
    public void AuthControllerDoesNotExposePublicRegistration()
    {
        var postRoutes = typeof(AuthController).GetMethods()
            .SelectMany(method => method.GetCustomAttributes(typeof(HttpPostAttribute), true).Cast<HttpPostAttribute>());

        Assert.DoesNotContain(postRoutes, route => route.Template == "register");
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