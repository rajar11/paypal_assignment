var http = require("http");
var https = require("https");
var fs = require("fs");
var url = require("url");

var records = new Array();
var currencyConversionArray = new Array();

var server = http.createServer(function(request,response) {    
	
	var urlObject = url.parse(request.url,true);
	var urlPath = urlObject.pathname;
	
	
	if(urlPath === "/paypal/activity")
	{
	   displayTransactionHistory(response);
	}
	else if(urlPath === "/paypal/currencyConversion")
	{
		response.writeHead(200, {"content-type" : "application/json" });
		performCurrencyConversion(request, response, urlObject);
	}
	else if(urlPath === "/paypal/conversionRate")
	{
	    getConversionRate(request, response, urlObject);
	}
	else
	{
	   response.writeHeader(404, {"content-type": "text/plain"});    
       response.write("Http 404: Not Found\n");
       response.end();
    }
	
}).listen(8080,performOneTimeInitialization);

// listen for TERM signal .e.g. kill 
process.on ('SIGTERM', performSaveAndCleanUp);

// listen for INT signal e.g. Ctrl-C
process.on ('SIGINT', performSaveAndCleanUp);

function performSaveAndCleanUp()
{
    var newContents="";
    if(typeof(currencyConversionArray["USD"]) != "undefined")
    {
    	for (key in currencyConversionArray)
    	{
        	if(key != "")
        	{
    			newContents += key;
    			newContents += "=";
    			newContents += currencyConversionArray[key][0];
    			newContents += " ";
    			newContents += currencyConversionArray[key][1];
    			newContents += "\r\n";
    		}
    	}
    
    	fs.writeFileSync("conversionRate.dat",newContents);
    }
    process.exit();
}

function performOneTimeInitialization()
{
	   console.log("Listening at port 8080");
	   var contents = fs.readFileSync("records.dat");
	   
	   if(contents != undefined)
	   {
	   		readDataFromFile(contents); 
	   }
	   
	   contents = fs.readFileSync("conversionRate.dat");
	   
	   if(contents != undefined)
	   {
	        readConversionRateFile(contents);
	   }

       return;
}
		
function displayTransactionHistory(response)
{
   // Check whether the data records was loaded from the data file
   // If it is not then error out otherwise display page

   if(records.length == 0)
   {
   		response.writeHeader(500, {"content-type": "text/plain" });
        response.write("Http Error 500: Internal Error. Could not load page");
        response.end();
   }
   else
   {
        response.writeHeader(200, {"content-type": "text/html" });
        response.write(generateHtml(records));
        response.end();
   }

   				
}

function performCurrencyConversion(request, response, urlObject)
{
   var query = urlObject.query;

   if(Object.keys(currencyConversionArray).length == 0)
   {
   		response.writeHeader(500, {"content-type": "text/plain" });
        response.write("Http Error 500: Internal Error. Could not convert value");
        response.end();
   }
   else
   {
        var amount = urlObject.query['amount'];
        var sourceCurrency = urlObject.query['srcCurCode'];
        var targetCurrency = urlObject.query['tgtCurCode'];

	amount = amount.replace(/"/g, "").trim();
        if(isNaN(parseFloat(amount)) || !isFinite(amount))
	{
        	response.writeHeader(500, {"content-type": "text/plain" });
        	response.write("Http Error 500: Internal Error. Invalid amount value :" + amount);
        	response.end();
	        return;	
	}

	sourceCurrency = sourceCurrency.replace(/"/g, "").trim().toUpperCase();
	targetCurrency = targetCurrency.replace(/"/g, "").trim().toUpperCase();

        if(typeof(currencyConversionArray[sourceCurrency]) != "undefined" && typeof(currencyConversionArray[targetCurrency]) != "undefined" )
	{
        	response.writeHeader(200, {"content-type": "application/json" });
        
        	var sourceConversionRate = currencyConversionArray[sourceCurrency][1];
        	var targetConversionRate = currencyConversionArray[targetCurrency][1];
        	var convertedAmount = (amount*targetConversionRate)/sourceConversionRate;
        
        
        
        	response.write("{\"results\": { \"amount\" : \"" + convertedAmount.toFixed(2) + "\", \"symbol\" : \"" + currencyConversionArray[targetCurrency][0] + "\" , \"currencyCode\" : \"" + targetCurrency + "\"}}");
        	response.end();
	}
        else
        {
        	response.writeHeader(500, {"content-type": "text/plain" });
        	response.write("Http Error 500: Internal Error. Invalid source or target currency code :" + sourceCurrency + "," + targetCurrency);
        	response.end();
	}
   }
}

function getConversionRate(request, response, urlObject)
{
   var query = urlObject.query;
   if(Object.keys(currencyConversionArray).length == 0)
   {
   		response.writeHeader(500, {"content-type": "text/plain" });
        response.write("Http Error 500: Internal Error. Could not convert value");
        response.end();
   }
   else
   {
        var sourceCurrency = urlObject.query['srcCurCode'];
        var targetCurrency = urlObject.query['tgtCurCode'];
        var realTime = urlObject.query['realTime'];
	realTime = realTime.replace(/"/g, "").trim().toLowerCase();
	sourceCurrency = sourceCurrency.replace(/"/g, "").trim().toUpperCase();
	targetCurrency = targetCurrency.replace(/"/g, "").trim().toUpperCase();
        
        if(typeof(currencyConversionArray[sourceCurrency]) != "undefined" && typeof(currencyConversionArray[targetCurrency]) != "undefined" )
        {
            if(realTime == "true")
            {
            	getRealTimeConversionRate(response, sourceCurrency,targetCurrency);
            }
            else
            {
        		sendConversionRateResponse(response, sourceCurrency,targetCurrency);
        	}        
        }
        else
        {
        	response.writeHeader(500, {"content-type": "text/plain" });
        	response.write("Http Error 500: Internal Error. Invalid source or target currency code :" + sourceCurrency + "," + targetCurrency);
        	response.end();
        }
        
   }
}

function readConversionRateFile(dataFromFile)
{
   var lines = dataFromFile.toString().split('\n');
   var currencyCode;
   var currencySymbol;
   var conversionRate;
   
   for(var i=0; i < lines.length; i++)
   {
       if(i == 0)
       {
           currencyCode = lines[i].toString().substring(lines[i].toString().indexOf("U"),lines[i].toString().indexOf('='));
       }
       else
       {
           currencyCode = lines[i].toString().substring(0,lines[i].toString().indexOf('='));
       }
       
       currencySymbol =  lines[i].toString().substring(lines[i].toString().indexOf('=') + 1, lines[i].toString().indexOf(' '));
       conversionRate =  lines[i].toString().substring(lines[i].toString().indexOf(' ') + 1);
       
       currencyConversionArray[currencyCode] = new Array(2);
       currencyConversionArray[currencyCode][0] = currencySymbol;
       currencyConversionArray[currencyCode][1] = conversionRate;
   }

}


function readDataFromFile(dataFromFile)
{
   var lines = dataFromFile.toString().split('\n');
   
   for(var i=0; i < lines.length; i++)
   {
       var columnValues = lines[i].toString().split(",");
       
       records[i] = new Array(columnValues.length);
       for(var j=0; j < columnValues.length; j++)
       {
       		records[i][j] = columnValues[j];
       }
   }
   
   return records;
}

function getRealTimeConversionRate(response, sourceCurrency, targetCurrency)
{
	https.get("https://openexchangerates.org/api/latest.json?app_id=11b54c33f2f74f0c96cd52da4e6fc411", function(res) {
	            res.on('data', function(d) {
    				  var jsonObject = JSON.parse(d.toString());
    				  currencyConversionArray[sourceCurrency][1] = jsonObject.rates[sourceCurrency].toFixed(2);
    				  currencyConversionArray[targetCurrency][1] = jsonObject.rates[targetCurrency].toFixed(2);
    				  sendConversionRateResponse(response,sourceCurrency,targetCurrency);    				  
  				});

			}).on('error', function(e) {
  					response.writeHeader(500, {"content-type": "text/plain" });
        			response.write("Http Error 500: Internal Error. Invalid source or target currency code :" + sourceCurrency + "," + targetCurrency);
        			response.end();
			});
}

function sendConversionRateResponse(response,sourceCurrency,targetCurrency)
{
	response.writeHeader(200, {"content-type": "application/json" });
    var sourceConversionRate = currencyConversionArray[sourceCurrency][1];
    var targetConversionRate = currencyConversionArray[targetCurrency][1];
    var rate = targetConversionRate/sourceConversionRate;
    response.write("{\"results\": { \"rate\" : \"" + rate.toFixed(2) + "\"}}");
    response.end();
}

function generateHtml(tableData)
{
   	   var htmlToBeRendered = " <!BODYTYPE html> " +
							  " <html> " +
    						  " <head> " +
        					  " <style> " +
            				  " h1 {color:blue} " +
            				  " table {margin:0 auto; width:600px ; text-align:center; border-collapse: collapse} " +
            				  " td {display:block; height: 50px} " +
            				  " .purchaseDate {margin:0 auto; text-align:center; width: 20%} " +
            				  " .purchaseDescription {margin : 0 auto; text-align:justify; width: 40%} " +
            				  " .purchaseCurrencyCode {margin : 0 auto; text-align:justify; width: 10%} " +
            				  " .purchaseAmount {margin :0 auto; text-align:center; width: 20%} " +
            				  " .currencySymbol {text-align:left} " +
            				  " .currencyAmount {text-align:right} " +
            				  " select { background-color: inherit ; border: none} " +
            				  " .grey { background-color: #A9A9A9} " +
            				  " .lightgrey { background-color: #F0FFF0} " +
        					  " </style> " +
    						  " </head> " +
    						  " <body> " +
        					  " <h1><center>Transaction History</center></h1> " +
        					  " <div> " ;
       var currencySelectOptions = " <option value=\"USD\">USD</option> " +
                            " <option value=\"EUR\">EUR</option> " +
                            " <option value=\"CAD\">CAD</option> " +
                            " <option value=\"CNY\">CNY</option> " +
                            " <option value=\"INR\">INR</option> ";
       var javascriptCode = " <script type=\"text/javascript\"> " +
                            " 		function onCurrencyCodeChange(element) { " +
                            "        var previousCurrencyCode = element.getAttribute(\"previous\"); " +
                            "        var newCurrencyCode = element.options[element.selectedIndex].value; " +
                            "        element.setAttribute(\"previous\",newCurrencyCode); " +
                            "        var currentElementId = element.id.substring(element.id.indexOf('_') + 1); " +
                            "        var amountValueElementId = \"purchaseAmount_\"" + " + currentElementId; " +
                            "        var amountValueElement = document.getElementById(\"purchaseAmount_\"" + " + currentElementId " + ").innerHTML.trim();" +
                            "        var amountValue = amountValueElement.substring(amountValueElement.indexOf(' ')); " +
                            "        var xmlHttp = new XMLHttpRequest(); " +
                            "        xmlHttp.onreadystatechange=function() " +
                            "        	{ " +
   							"				if (xmlHttp.readyState==4 && xmlHttp.status== 200) " +
     						"				{ " +
     						"                   var jsonObject = JSON.parse(xmlHttp.responseText); " +
     						"                   document.getElementById(amountValueElementId).innerHTML = jsonObject.results.symbol + \" \" + jsonObject.results.amount; " +
     						"				} " +
     						"               else if  (xmlHttp.readyState==4 && xmlHttp.status != 200) " + 
     						"               { " +
     						"                   alert(\"Error converting amount to the selected currency!!!\"); " +
     						"               } " +    						
   							"			}; " +
   							"        var url = \"currencyConversion?amount=\" + amountValue + \"&srcCurCode=\" + previousCurrencyCode + \"&tgtCurCode=\" + newCurrencyCode;" +
   							"        xmlHttp.open(\"GET\",url,true); " +
   							"        xmlHttp.send(); " +
                            "        } " +
                            " </script> ";
                            
	   var table = "<table>";
	   
	   for(var i=0;i<tableData.length;i++)
	   {
	        var trClass = "lightgrey";
	        if((i+1)%2 == 0)
	        {
	            trClass = "grey";
	        }
	   		table += " <tr class=\"" + trClass + "\"> ";
	   		table += " <td " + "id=\"purchaseDate_" + i + "\" " + "class=\"purchaseDate\"> ";
	   		table += tableData[i][0];
	   		table += " </td> ";
	   		table += " <td " + "id=\"purchaseDescription_" + i + "\" " + "class=\"purchaseDescription\"> ";
	   		table += tableData[i][1];
	   		table += " </td> ";
	   		table += " <td " + "id=\"purchaseCurrencyCode_" + i + "\" " + "class=\"purchaseCurrencyCode\"> ";
	   		table += " <select previous=\"USD\" id=\"currencyCodeSelect_" + i + "\" onchange=onCurrencyCodeChange(this)> ";
	   		table += currencySelectOptions;
	   		table += " </select> ";
	   		table += " </td> ";
	   		table += " <td " + "id=\"purchaseAmount_" + i + "\" " + "class=\"purchaseAmount\"> ";
	   		table += tableData[i][2];
	   		table += " </td> ";
	   		table += " </tr> ";
	   		
	   }
	   
	   table += " </table> ";
	   
	   htmlToBeRendered += table;
	   htmlToBeRendered += " </div> ";
	   htmlToBeRendered += " </body> " + javascriptCode + " </html>";

	   return htmlToBeRendered;
}
