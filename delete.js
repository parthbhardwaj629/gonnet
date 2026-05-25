const express = require("express");
const cron = require("node-cron");

module.exports = function(Customer, transporter, GMAIL_USER){

const router = express.Router();

// DELETE ACCOUNT
router.delete("/delete-account", async (req,res)=>{

  try{

    const { email } = req.body;

    if(!email){

      return res.status(400).json({
        error:"Email required"
      });

    }

    const customers = await Customer.find({
      email,
      isActive:true
    });

    if(customers.length === 0){

      return res.status(404).json({
        error:"No active account found"
      });

    }

    await Customer.updateMany(

      { email },

      {
        $set:{
          isActive:false,
          isDeleted:true,
          deletionRequestedAt:new Date()
        }
      }

    );

    // EMAIL
    try{

      await transporter.sendMail({

        from:`Gonnet <${GMAIL_USER}>`,

        to:email,

        subject:"Gonnet Account Deletion Request",

        html:`

          <h2>Account Deletion Initiated</h2>

          <p>Your Gonnet account and associated profiles have been disabled.</p>

          <p>Your data is scheduled for permanent deletion after 30 days.</p>

          <p>If this request was accidental, you may contact support before permanent deletion.</p>

          <br>

          <p>Team Gonnet</p>

        `

      });

    }catch(e){

      console.log("Delete email error:", e);

    }

    res.json({
      success:true,
      message:"Account deleted successfully"
    });

  }catch(err){

    console.log(err);

    res.status(500).json({
      error:"Delete failed"
    });

  }

});
// ========================================
// AUTO CLEANUP CRON
// ========================================

cron.schedule("* 2 * * *", async ()=>{

  console.log("🧹 Running deletion cleanup job...");

  try{

    const THIRTY_DAYS =
      30 * 24 * 60 * 60 * 1000;

    const thirtyDaysAgo = new Date(
      Date.now() - THIRTY_DAYS
    );

    const accounts = await Customer.find({

      isDeleted:true,

      deletionRequestedAt:{
        $lte: thirtyDaysAgo
      },

      permanentlyDeleted:{
        $ne:true
      }

    });

    console.log(
      `Found ${accounts.length} accounts`
    );

    for(const acc of accounts){

      const userEmail = acc.email;

      await Customer.updateOne(

        { _id: acc._id },

        {
          $set:{

            name:null,
            mobile:null,
            email:null,
            emergencyName:null,
            emergencyRelation:null,
            emergencyNumber:null,
            bio:null,
            photo:null,

            socialLinks:{},

            permanentlyDeleted:true,
            permanentDeletionAt:new Date()

          }
        }

      );

      try{

        if(userEmail){

          await transporter.sendMail({

            from:`Gonnet <${GMAIL_USER}>`,

            to:userEmail,

            subject:"Gonnet Data Permanently Deleted",

            html:`

              <h2>Permanent Deletion Completed</h2>

              <p>Your Gonnet personal data has now been permanently anonymized.</p>

              <p>Team Gonnet</p>

            `

          });

        }

      }catch(e){

        console.log(e);

      }

      console.log(
        `✅ Permanently anonymized: ${userEmail}`
      );

    }

  }catch(err){

    console.log(err);

  }

});
return router;

};