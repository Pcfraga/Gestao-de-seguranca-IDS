using System.Data;
using System.Security.Cryptography;
using System.Text;
using IDS.Api.Authentication;
using IDS.Infrastructure.Identity;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace IDS.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    UserManager<IdsUser> userManager,
    RoleManager<IdentityRole<Guid>> roleManager,
    IdsDbContext dbContext,
    AccessTokenService tokenService,
    IConfiguration configuration) : ControllerBase
{
    private static readonly string[] AllowedRoles = ["ADMINISTRADOR", "GESTOR", "AVALIADOR", "CONSULTA"];

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || await userManager.IsLockedOutAsync(user))
        {
            return Unauthorized();
        }

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await userManager.AccessFailedAsync(user);
            return Unauthorized();
        }

        await userManager.ResetAccessFailedCountAsync(user);
        var (token, expiresAt) = await tokenService.CreateAsync(user, cancellationToken);
        return Ok(new LoginResponse(token, expiresAt, user.DisplayName ?? user.Email ?? string.Empty));
    }

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("bootstrap-admin")]
    public async Task<IActionResult> BootstrapAdministrator(
        BootstrapAdministratorRequest request,
        CancellationToken cancellationToken)
    {
        var setupKey = configuration["INITIAL_ADMIN_SETUP_KEY"];
        if (string.IsNullOrWhiteSpace(setupKey) || !FixedTimeEquals(setupKey, request.SetupKey))
        {
            return Unauthorized();
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        if (await userManager.Users.AnyAsync(cancellationToken))
        {
            return Conflict(new { message = "O administrador inicial já foi configurado." });
        }

        var user = new IdsUser
        {
            Id = Guid.NewGuid(),
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            DisplayName = request.DisplayName.Trim(),
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(error => error.Description) });
        }

        if (!await roleManager.RoleExistsAsync("ADMINISTRADOR"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return Conflict(new { message = "Execute as migrations antes de configurar o administrador." });
        }

        var roleResult = await userManager.AddToRoleAsync(user, "ADMINISTRADOR");
        if (!roleResult.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Não foi possível atribuir o perfil administrador." });
        }

        await transaction.CommitAsync(cancellationToken);
        return Created("/api/auth/me", new { user.Id, user.Email, user.DisplayName, role = "ADMINISTRADOR" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            user.Id,
            user.Email,
            user.DisplayName,
            roles = await userManager.GetRolesAsync(user)
        });
    }

    [Authorize(Roles = "ADMINISTRADOR")]
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateUserRequest request, CancellationToken cancellationToken)
    {
        var role = request.Role.Trim().ToUpperInvariant();
        if (!AllowedRoles.Contains(role, StringComparer.Ordinal))
        {
            return BadRequest(new { message = "Perfil inválido." });
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var user = new IdsUser
        {
            Id = Guid.NewGuid(),
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            DisplayName = request.DisplayName.Trim(),
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(error => error.Description) });
        }

        var roleResult = await userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Não foi possível atribuir o perfil solicitado." });
        }

        await transaction.CommitAsync(cancellationToken);
        return Created("/api/auth/users", new { user.Id, user.Email, user.DisplayName, role });
    }

    private static bool FixedTimeEquals(string expected, string provided)
    {
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var providedBytes = Encoding.UTF8.GetBytes(provided);
        return expectedBytes.Length == providedBytes.Length
            && CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }
}

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, string DisplayName);

public sealed record BootstrapAdministratorRequest(string SetupKey, string Email, string DisplayName, string Password);

public sealed record CreateUserRequest(string Email, string DisplayName, string Password, string Role);