param([long]$WindowHandle)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CalculatorNativeCheck {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr window, IntPtr region);
 [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
 [DllImport("user32.dll", EntryPoint="SendMessageW")] public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);
 [DllImport("gdi32.dll")] public static extern int GetRgnBox(IntPtr region, out Rect rect);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr region, int x, int y);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr value);
}
'@
$region=[CalculatorNativeCheck]::CreateRectRgn(0,0,0,0)
try {
 $kind=[CalculatorNativeCheck]::GetWindowRgn([IntPtr]$WindowHandle,$region)
 $bounds=New-Object CalculatorNativeCheck+Rect
 [CalculatorNativeCheck]::GetRgnBox($region,[ref]$bounds) | Out-Null
 $style=[CalculatorNativeCheck]::GetWindowLongPtr([IntPtr]$WindowHandle,-16).ToInt64()
 [CalculatorNativeCheck]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
 $windowRect=New-Object CalculatorNativeCheck+Rect
 [CalculatorNativeCheck]::GetWindowRect([IntPtr]$WindowHandle,[ref]$windowRect) | Out-Null
 $scale=[CalculatorNativeCheck]::GetDpiForWindow([IntPtr]$WindowHandle)/96.0
 $x=$windowRect.Left+[int](160*$scale)
 $y=$windowRect.Top+[int](24*$scale)
 $point=($x -band 0xffff) -bor (($y -band 0xffff) -shl 16)
 $hit=[CalculatorNativeCheck]::SendMessage([IntPtr]$WindowHandle,0x84,[IntPtr]::Zero,[IntPtr]$point).ToInt64()
 @{regionKind=$kind;hasNativeCaption=(($style -band 0x00C00000) -ne 0);
   titleHitTest=$hit;
   cornerAcceptsInput=[CalculatorNativeCheck]::PtInRegion($region,0,0);
   centerAcceptsInput=[CalculatorNativeCheck]::PtInRegion($region,[int](($bounds.Right+$bounds.Left)/2),[int](($bounds.Bottom+$bounds.Top)/2))
 } | ConvertTo-Json -Compress
} finally { [CalculatorNativeCheck]::DeleteObject($region) | Out-Null }
