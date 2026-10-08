FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY IDS.sln ./
COPY backend/src/IDS.Domain/IDS.Domain.csproj backend/src/IDS.Domain/
COPY backend/src/IDS.Application/IDS.Application.csproj backend/src/IDS.Application/
COPY backend/src/IDS.Infrastructure/IDS.Infrastructure.csproj backend/src/IDS.Infrastructure/
COPY backend/src/IDS.Api/IDS.Api.csproj backend/src/IDS.Api/
RUN dotnet restore backend/src/IDS.Api/IDS.Api.csproj
COPY backend/src/ backend/src/
RUN dotnet publish backend/src/IDS.Api/IDS.Api.csproj --configuration Release --output /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "IDS.Api.dll"]