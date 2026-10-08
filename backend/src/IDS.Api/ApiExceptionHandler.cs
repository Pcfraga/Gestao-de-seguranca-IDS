using System.Net.Sockets;
using Microsoft.AspNetCore.Diagnostics;

namespace IDS.Api;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (!IsDatabaseUnavailable(exception))
        {
            logger.LogError(exception, "Falha não tratada na API.");
            httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await httpContext.Response.WriteAsJsonAsync(
                new { code = "internal_error", message = "Ocorreu um erro interno." },
                cancellationToken);
            return true;
        }

        logger.LogWarning(exception, "A operação não pôde acessar o PostgreSQL.");
        httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await httpContext.Response.WriteAsJsonAsync(
            new { code = "database_unavailable", message = "O banco de dados está indisponível. Tente novamente mais tarde." },
            cancellationToken);
        return true;
    }

    private static bool IsDatabaseUnavailable(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is SocketException or TimeoutException
                || current.GetType().FullName?.StartsWith("Npgsql.", StringComparison.Ordinal) == true)
            {
                return true;
            }
        }

        return false;
    }
}