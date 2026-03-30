 = 'C:\Users\91906\Ai ssc\frontend\data\mensuration_questions.json'
 = Get-Content -Path  -Raw
 =  -replace ' question: \[Q\d+\] ?, question: '
Set-Content -Path  -Value  -Encoding UTF8
 = (Select-String -Path  -Pattern '\[Q\d+' -AllMatches).Matches.Count
Write-Host 'remaining markers:' 
