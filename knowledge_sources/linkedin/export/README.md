# LinkedIn data export goes here

LinkedIn → Settings & Privacy → Data privacy → **Get a copy of your data** →
"Download larger data archive" → unzip → upload these CSVs into this folder
(GitHub: *Add file → Upload files*):

    Shares.csv            posts            Positions.csv       roles
    Events.csv            events           Certifications.csv  certifications
    Honors.csv            honors/awards    Publications.csv    publications
    Projects.csv          projects         Recommendations_Received.csv
    Skills.csv            skills           Courses.csv · Languages.csv

The Factory reads whatever is present; missing files are skipped. Nothing is
fetched from linkedin.com. Re-export every few months to keep posts current.
