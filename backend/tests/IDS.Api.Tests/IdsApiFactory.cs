using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Api.Tests;

public sealed class IdsApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("APPLY_MIGRATIONS", "false");
        builder.UseSetting("DATABASE_CONNECTION", "Host=127.0.0.1;Port=1;Database=ids_test;Username=test;Password=test;Timeout=1;Command Timeout=1");
        builder.UseSetting("AUTH_SIGNING_KEY", "integration-tests-only-signing-key-at-least-32-bytes");
        builder.UseSetting("ALLOWED_ORIGINS", string.Empty);
        builder.ConfigureServices(services =>
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                // These tests exercise validation with an intentionally unavailable database.
                options.Events.OnTokenValidated = _ => Task.CompletedTask;
            }));
    }
}