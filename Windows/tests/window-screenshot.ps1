param([long]$WindowHandle, [string]$OutputPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CalculatorDesktopCapture {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
}
'@
[CalculatorDesktopCapture]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
$rect=New-Object CalculatorDesktopCapture+Rect
if(-not [CalculatorDesktopCapture]::GetWindowRect([IntPtr]$WindowHandle,[ref]$rect)){throw 'Window bounds unavailable'}
$margin=12
$width=$rect.Right-$rect.Left
$height=$rect.Bottom-$rect.Top
$bitmap=New-Object Drawing.Bitmap(($width+2*$margin),($height+2*$margin))
$graphics=[Drawing.Graphics]::FromImage($bitmap)
try {
 $graphics.CopyFromScreen(($rect.Left-$margin),($rect.Top-$margin),0,0,$bitmap.Size)
 $bitmap.Save($OutputPath,[Drawing.Imaging.ImageFormat]::Png)
 $points=@(@(2,2),@(($width-3),2),@(2,($height-3)),@(($width-3),($height-3)))
 $colors=@(foreach($point in $points){$bitmap.GetPixel(($margin+$point[0]),($margin+$point[1])).ToArgb()})
 @{width=$width;height=$height;cornerPixels=$colors} | ConvertTo-Json -Compress
} finally {$graphics.Dispose();$bitmap.Dispose()}
