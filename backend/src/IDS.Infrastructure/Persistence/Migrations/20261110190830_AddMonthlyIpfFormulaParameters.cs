using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMonthlyIpfFormulaParameters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AdditionalScore",
                table: "monthly_ipf_records",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MultiplicationFactor",
                table: "monthly_ipf_records",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdditionalScore",
                table: "monthly_ipf_records");

            migrationBuilder.DropColumn(
                name: "MultiplicationFactor",
                table: "monthly_ipf_records");
        }
    }
}
