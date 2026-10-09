using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace IDS.Api.Tests;

public sealed class CompanyApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("APPLY_MIGRATIONS", "false");
        builder.UseSetting("DATABASE_CONNECTION", "Host=localhost;Database=unused");
        builder.UseSetting("AUTH_SIGNING_KEY", "company-tests-only-signing-key-at-least-32-bytes");
        connection.Open();
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<IdsDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<IdsDbContext>>();
            services.AddDbContext<IdsDbContext>(options => options.UseSqlite(connection)
                .ReplaceService<IModelCustomizer, SqliteTestModelCustomizer>());
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IdsDbContext>().Database.EnsureCreated();
        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) connection.Dispose();
    }
}

public sealed class SqliteTestModelCustomizer(ModelCustomizerDependencies dependencies) : ModelCustomizer(dependencies)
{
    public override void Customize(ModelBuilder modelBuilder, DbContext context)
    {
        base.Customize(modelBuilder, context);
        // SQLite cannot order DateTimeOffset directly; production uses PostgreSQL.
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties()
                .Where(property => property.ClrType == typeof(DateTimeOffset) || property.ClrType == typeof(DateTimeOffset?)))
            {
                modelBuilder.Entity(entity.ClrType).Property(property.Name).HasConversion<long>();
            }
        }
    }
}
