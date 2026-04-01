<?php

$env = parse_ini_file("../.env");

$username = $env['ADMIN_USERNAME'];
$password = $env['ADMIN_PASSWORD'];
$host = $env['HOSTNAME'];
$dbname = $env['DBNAME'];
$dsn = "mysql:host=$host;dbname=$dbname";

/** connect to the database **/
try 
{   
//  $db = new PDO("mysql:host=$hostname;dbname=db-demo", $username, $password);
   $db = new PDO($dsn, $username, $password); 
   
   // display a message to let us know that we are connected to the database
   echo "<p>You are connected to the database -- host=$host as user=$username</p>";
}
catch (PDOException $e)     // handle a PDO exception (errors thrown by the PDO library)
{
   // Call a method from any object, use the object's name followed by -> and then method's name
   // All exception objects provide a getMessage() method that returns the error message 
   $error_message = $e->getMessage();        
   echo "<p>An error occurred while connecting to the database: $error_message </p>";
}
catch (Exception $e)       // handle any type of exception
{
   $error_message = $e->getMessage();
   echo "<p>Error message: $error_message </p>";
}


?>