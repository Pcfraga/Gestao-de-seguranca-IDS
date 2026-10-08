using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace IDS.Api.Tests;

public sealed class IdsApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("DATABASE_CONNECTION", "Host=127.0.0.1;Port=1;Database=ids_test;Username=test;Password=test;Timeout=1;Command Timeout=1");
        builder.UseSetting("AUTH_SIGNING_KEY", "integration-tests-only-signing-key-at-least-32-bytes");
        builder.UseSetting("INITIAL_ADMIN_SETUP_KEY", "integration-tests-only-bootstrap-key");
        builder.UseSetting("ALLOWED_ORIGINS", string.Empty);
    }
}