Option Explicit
Dim sh, fso, dir, url, i
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://127.0.0.1:4321/"

Function Vivo()
  Dim h
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  h.setTimeouts 500, 500, 800, 800
  h.open "GET", url & "api/ping", False
  h.send
  Vivo = (Err.Number = 0 And h.Status = 200)
  Err.Clear
End Function

If Not Vivo() Then
  sh.CurrentDirectory = dir
  sh.Run "node """ & dir & "\server.js""", 0, False
  For i = 1 To 30
    WScript.Sleep 300
    If Vivo() Then Exit For
  Next
End If

If Vivo() Then
  sh.Run url
Else
  MsgBox "Não consegui ligar a Mochila." & vbCrLf & "Abra o ""Abrir Mochila.bat"" para ver o erro (precisa do Node.js instalado).", 48, "Mochila"
End If
