using IDS.Api;
using IDS.Infrastructure;
using IDS.Infrastructure.Identity;
using IDS.Infrastructure.Persistence;
using IDS.Application.Evaluations;
using IDS.Application.Reports;
using IDS.Api.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<EvaluationApplicationService>();
builder.Services.AddScoped<MonthlyIpfApplicationService>();
builder.Services.AddScoped<AccessTokenService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IDS.Infrastructure.Persistence.ICurrentUserScope, IDS.Api.Authentication.HttpCurrentUserScope>();

var signingKey = builder.Configuration["AUTH_SIGNING_KEY"];
if (string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey) < 32)
{
    throw new InvalidOperationException("Configure AUTH_SIGNING_KEY com pelo menos 32 bytes via secret manager ou ambiente.");
}

var issuer = builder.Configuration["AUTH_ISSUER"] ?? "IDS.Api";
var audience = builder.Configuration["AUTH_AUDIENCE"] ?? "IDS.Frontend";
builder.Services.AddIdentityCore<IdsUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<IdsDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var tenantClaim = context.Principal?.FindFirst("tenant_id")?.Value;
                if (!Guid.TryParse(tenantClaim, out var tenantId))
                {
                    context.Fail("A sessão não identifica uma empresa. Entre novamente.");
                    return;
                }

                var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<IdsUser>>();
                var user = await users.GetUserAsync(context.Principal!);
                if (user is null || user.TenantId != tenantId || await users.IsLockedOutAsync(user))
                {
                    context.Fail("Conta indisponível para esta empresa.");
                }
            }
        };
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddRateLimiter(options =>
    options.AddFixedWindowLimiter("auth", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    }));

var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToList();
if (builder.Environment.IsDevelopment())
{
    allowedOrigins.Add("http://localhost:5173");
    allowedOrigins.Add("http://localhost:5174");
}

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins.Distinct(StringComparer.OrdinalIgnoreCase).ToArray()).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (builder.Configuration.GetValue<bool>("APPLY_MIGRATIONS"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<IdsDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
