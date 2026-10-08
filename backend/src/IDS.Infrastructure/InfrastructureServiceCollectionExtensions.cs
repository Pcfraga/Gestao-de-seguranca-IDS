using IDS.Infrastructure.Persistence;
using IDS.Application.Evaluations;
using IDS.Application.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Infrastructure;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration["DATABASE_CONNECTION"];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Configure a variável DATABASE_CONNECTION para iniciar a API.");
        }

        services.AddDbContext<IdsDbContext>(options => options.UseNpgsql(
            connectionString,
            postgres => postgres.MigrationsAssembly(typeof(IdsDbContext).Assembly.FullName)));
        services.AddScoped<IEvaluationRepository, EfEvaluationRepository>();
        services.AddScoped<IMonthlyIpfRepository, EfMonthlyIpfRepository>();

        return services;
    }
}