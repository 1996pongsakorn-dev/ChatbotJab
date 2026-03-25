param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [string]$Region = "us-central1",
  [string]$ServiceName = "toyota-sales-agent",
  [string]$Repository = "toyota-poc",
  [string]$ImageName = "sales-agent"
)

$ErrorActionPreference = "Stop"

Write-Host "Setting gcloud project..."
gcloud config set project $ProjectId

Write-Host "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe $Repository --location $Region 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud artifacts repositories create $Repository `
    --repository-format=docker `
    --location=$Region `
    --description="Toyota Sales Agent images"
}

Write-Host "Submitting Cloud Build..."
gcloud builds submit `
  --config cloudbuild.yaml `
  --substitutions _REGION=$Region,_SERVICE_NAME=$ServiceName,_REPOSITORY=$Repository,_IMAGE_NAME=$ImageName

Write-Host "Done. Check service URL with:"
Write-Host "gcloud run services describe $ServiceName --region $Region --format='value(status.url)'"
