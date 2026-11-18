using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations;

[DbContext(typeof(IdsDbContext))]
[Migration("20261118123000_AddEvaluationClientOperationId")]
public partial class AddEvaluationClientOperationId : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "ClientOperationId",
            table: "evaluations",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_evaluations_TenantId_ClientOperationId",
            table: "evaluations",
            columns: new[] { "TenantId", "ClientOperationId" },
            unique: true,
            filter: "\"ClientOperationId\" IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_evaluations_TenantId_ClientOperationId",
            table: "evaluations");

        migrationBuilder.DropColumn(
            name: "ClientOperationId",
            table: "evaluations");
    }
}
