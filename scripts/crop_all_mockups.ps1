Add-Type -AssemblyName System.Drawing

$mockupDir = "d:\itacon_app\assets\images\mockups"
$files = Get-ChildItem "$mockupDir\*.jpeg"

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]95)

$count = 0
$total = $files.Count
Write-Host "Starting batch crop of $total mockup images..."

foreach ($f in $files) {
    $tempFile = "$mockupDir\temp_$($f.Name)"
    
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $W = $img.Width
    $H = $img.Height
    
    # Standard crop for 2717x1890 catalog pages
    if ($W -eq 2717 -and $H -eq 1890) {
        $cropX = 50
        $cropY = 36
        $cropW = 2630
        $cropH = 1720
    } else {
        # Proportional crop if size differs
        $cropX = [int]($W * (50 / 2717))
        $cropY = [int]($H * (36 / 1890))
        $cropW = [int]($W * (2630 / 2717))
        $cropH = [int]($H * (1720 / 1890))
    }
    
    $rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $cropBmp = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height)
    $g = [System.Drawing.Graphics]::FromImage($cropBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $rect.Width, $rect.Height)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    
    $cropBmp.Save($tempFile, $codec, $encoderParams)
    $cropBmp.Dispose()
    $img.Dispose()
    
    # Replace original file
    Move-Item -Path $tempFile -Destination $f.FullName -Force
    $count++
    if ($count % 10 -eq 0 -or $count -eq $total) {
        Write-Host "Processed $count of $total images..."
    }
}

Write-Host "Batch crop complete! All $total mockup images have had black borders removed."
